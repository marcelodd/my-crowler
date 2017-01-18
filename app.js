var express = require('express');
var fs = require('fs');
var request = require('request').defaults({ jar: true });
var cheerio = require('cheerio');
var app = express();

app.get('/pesquisar/:gtin', function (req, res) {
    pesquisar(req.params.gtin, function (result) {
        res.status(200).json(result);
    }, function (error) {
        console.log(error);
    });
});

function authenticity_token(successCallback, errorCallback) {
    request('http://cosmos.bluesoft.com.br/users/sign_in', function (error, response, html) {
        if (!error) {
            var $ = cheerio.load(html);
            var authenticityToken = $('input[name="authenticity_token"]').prop('value', '').val();
            successCallback(authenticityToken);
        } else {
            errorCallback(error);
        }
    });
}

function pesquisar(gtin, successCallback, errorCallback) {
    if (app.get('expires_in') < new Date()) {
        var url = 'http://cosmos.bluesoft.com.br/pesquisar?utf8=true&q=' + gtin;
        request(url, function (error, response, html) {
            if (!error) {
                successCallback(tranformHTML(html));
            } else {
                errorCallback(error);
            }
        });
    } else {
        autenticar(function () {
            request('http://cosmos.bluesoft.com.br/pesquisar?utf8=true&q=' + gtin, function (error, response, html) {
                if (!error) {
                    successCallback(tranformHTML(html));
                } else {
                    errorCallback(error);
                }
            });
        }, function (error) {
            console.log(error);
        });
    }

}

function autenticar(successCallback, errorCallback) {
    authenticity_token(function (token) {
        request.post({
            url: 'http://cosmos.bluesoft.com.br/users/sign_in',
            form: {
                "utf8": true,
                "authenticity_token": token,
                "user[supplier_creation_token]": "",
                "user[distributor_creation_token]": "",
                "user[email]": "suporte@t2tecnologia.com.br",
                "user[password]": "T2tecnologia",
                "user[remember_me]": 0,
                "commit": "Entrar"
            }
        }, function (err, response, body) {
            console.log('Autenticado com sucesso');
            app.set('expires_in', new Date().setHours(1));
            successCallback();
        });
    }, function (error) {
        errorCallback(error);
    });
}

function tranformHTML(html) {
    var $ = cheerio.load(html);
    var a = $('body #container-principal section .seal');
    var _id = $('body #container-principal section .seal')[0].attribs.name.substring(5);
    var csrf_token = $('head meta[name="csrf-token"]')[0].attribs.content;

    var products_details = 'body #container-principal section';
    var tab_content = 'body #container-principal section';

    var descricao = $(products_details + ' h1')
        .children()[0].prev.data.replace(/\n/g, '');

    var ncm = $(products_details + ' .ncm-name a')
        .text()
        .substring(0, 10).replace('.', '').replace('.', '').replace('\n', '');

    var cest = $(products_details + ' .cest-name a')
        .text()
        .substring(0, 10).replace('.', '').replace('.', '').replace('\n', '');

    var pis = [];
    var cofins = [];

    $(tab_content + ' #figura-' + _id + '-federal')
        .children('.table-responsive')
        .children('table')
        .children('tbody').each(function (i, elem) {
            var _pis = newPisCofins();
            var _cofins = newPisCofins();
            if (i === 0) {
                _pis.cumulativo = false;
                _cofins.cumulativo = false;
            } else {
                _pis.cumulativo = true;
                _cofins.cumulativo = true;
            }

            _pis.cst_entrada = $(this).children('tr').children('td')[0].children[0].data.replace(/\n/g, '').substring(0, 2);
            _pis.cst_saida = $(this).children('tr').children('td')[1].children[0].data.replace(/\n/g, '').substring(0, 2);
            _cofins.cst_entrada = _pis.cst_entrada;
            _cofins.cst_saida = _pis.cst_saida;

            _pis.aliquota_entrada = parseFloat($(this).children('tr').children('td')[2].children[0].data.replace(',', '.').substring(0, 4));
            _pis.aliquota_saida = parseFloat($(this).children('tr').children('td')[3].children[0].data.replace(',', '.').substring(0, 4));

            _cofins.aliquota_entrada = parseFloat($(this).children('tr').children('td')[4].children[0].data.replace(',', '.').substring(0, 4));
            _cofins.aliquota_saida = parseFloat($(this).children('tr').children('td')[5].children[0].data.replace(',', '.').substring(0, 4));

            pis.push(_pis);
            cofins.push(_cofins);
        });


    var icmsEntrada = [];
    var icmsSaida = [];

    $(tab_content + ' #figura-' + _id + '-state #states-pagination').children('option').each(function (i, elem) {
        var state = '.state-' + $(this)[0].children[0].data.replace(/\n/g, '');
        var _icmsEntrada = newIcmsEntrada();
        var _icmsSaida = newIcmsSaida();

        _icmsEntrada.uf = $(state)[0].children[1].children[0].data.replace(/\n/g, '');
        _icmsEntrada.origem = $(state)[0].children[3].children[0].data.replace(/\n/g, '').substring(0, 1);
        _icmsEntrada.cst = $(state)[0].children[3].children[0].data.replace(/\n/g, '').substring(1, 3);
        _icmsEntrada.aliquota = parseFloat($(state)[0].children[5].children[0].data.replace(/\n/g, '').substring(0, 5).replace(',', '.'));
        _icmsEntrada.reducao = parseFloat($(state)[0].children[7].children[0].data.replace(/\n/g, '').replace('%', '').replace(',', '.'));
        _icmsEntrada.tipo_mva = $(state)[0].children[9].children[0].data.replace(/\n/g, '');
        _icmsEntrada.valor_mva = parseFloat($(state)[0].children[11].children[0].data.replace(/\n/g, '').replace(',', '.'));
        _icmsEntrada.inicio_mva = $(state)[0].children[13].children[0].data.replace(/\n/g, '');
        _icmsEntrada.fim_mva = $(state)[0].children[15].children[0].data.replace(/\n/g, '');

        _icmsSaida.uf = $(state)[1].children[1].children[0].data.replace(/\n/g, '');
        _icmsSaida.origem_destino = $(state)[1].children[3].children[0].data.replace(/\n/g, '');
        _icmsSaida.origem = $(state)[1].children[5].children[0].data.replace(/\n/g, '').substring(0, 1);
        _icmsSaida.cst = $(state)[1].children[5].children[0].data.replace(/\n/g, '').substring(1, 3);
        _icmsSaida.aliquota = parseFloat($(state)[1].children[7].children[0].data.replace(/\n/g, '').replace('%', '').replace(',', '.'));
        _icmsSaida.reducao = parseFloat($(state)[1].children[9].children[0].data.replace(/\n/g, '').replace('%', '').replace(',', '.'));

        icmsEntrada.push(_icmsEntrada);
        icmsSaida.push(_icmsSaida);
    });

    var tributacaoMedia = [];
    $(tab_content + ' #tributacao-media-' + _id + ' #states-average-taxes-pagination').children('option').each(function (i, elem) {
        var uf = $(this)[0].children[0].data.replace(/\n/g, '');
        var _tribMedia = newTributacaoMedia();

        _tribMedia.uf = uf;
        _tribMedia.aliq_nacional_fed = parseFloat($('.state-' + uf)[0].children[3].children[0].data.replace(/\n/g, '').replace('%', '').replace(',', '.'));
        _tribMedia.aliq_importados_fed = parseFloat($('.state-' + uf)[1].children[3].children[0].data.replace(/\n/g, '').replace('%', '').replace(',', '.'));
        _tribMedia.aliq_estadual = parseFloat($('.state-' + uf)[2].children[3].children[0].data.replace(/\n/g, '').replace('%', '').replace(',', '.'));
        _tribMedia.chave = $('.state-' + uf)[3].children[3].children[0].data.replace(/\n/g, '');

        tributacaoMedia.push(_tribMedia);
    });

    var observacoes = newObservacao();
    $(tab_content + ' .page-subheader .table tbody tr').each(function (i, elem) {
        var a = $(this);
        observacoes.gtin = $(this)[0].children[1].children[0].data.replace(/\n/g, '');
        observacoes.unidade = $(this)[0].children[3].children[1].children[0].data.replace(/\n/g, '');
        observacoes.embalagem = parseFloat($(this)[0].children[5].children[0].data.replace(/\n/g, ''));
        observacoes.lastro = $(this)[0].children[7].children[0].data.replace(/\n/g, '');
        observacoes.camada = $(this)[0].children[9].children[0].data.replace(/\n/g, '');
        observacoes.comprimento = $(this)[0].children[11].children[0].data.replace(/\n/g, '');
        observacoes.altura = $(this)[0].children[13].children[0].data.replace(/\n/g, '');
        observacoes.largura = $(this)[0].children[15].children[0].data.replace(/\n/g, '');
        observacoes.peso_bruto = $(this)[0].children[17].children[0].data.replace(/\n/g, '');
        observacoes.peso_liquido = $(this)[0].children[19].children[0].data.replace(/\n/g, '');
    });

    buscarSimilares(_id, csrf_token);

    var produto = {
        descricao: descricao,
        ncm: ncm,
        cest: cest,
        pis: pis,
        cofins: cofins,
        icmsEntrada: icmsEntrada,
        icmsSaida: icmsSaida,
        tributacaoMedia: tributacaoMedia,
        observacoes: observacoes
    };

    fs.readFile('result.json', 'utf8', function readFileCallback(err, data) {
        if (err) {
            console.log(err);
        } else {
            obj = JSON.parse(data); //now it an object
            obj.push(produto); //add some data
            json = JSON.stringify(obj); //convert it back to json
            fs.writeFile('result.json', json, 'utf8', function () {
                console.log('Produto Gravado: ', produto.observacoes.gtin);
            }); // write it back 
        }
    });

    /*fs.writeFile('result.json', JSON.stringify(produto, null, 4), function (err) {
        console.log('File successfully written! - Check your project directory for the output.json file');
    });*/

    return produto;
}

function buscarSimilares(id, csrf_token) {
    var url = 'http://cosmos.bluesoft.com.br/federal_tax_profiles/' + id + '/products'

    request({
        url: url,
        headers: {
            'X-CSRF-Token': csrf_token,
            'X-Requested-With': 'XMLHttpRequest'
        }
    }, function (error, response, body) {
        var bodyNormalize = body.replace(/[\\"]/g, '');
        bodyNormalize = bodyNormalize.replace(/>n</g, '><');

        var start = bodyNormalize.search('<tbody>');
        var end = bodyNormalize.search('</tbody>');

        var tbody = bodyNormalize.substring(start, end + 8);
        var $ = cheerio.load(tbody);

        /*fs.writeFile('tbody.html', tbody, function (err) {
            console.log('File successfully written! - Check your project directory for the output.json file');
        });*/

        $('tr').each(function (i, elem) {
            var gtin = elem.children[0].children[0].children[0].data;

            sleep(5000);
            pesquisar(gtin, function (result) {
                console.log(result);
            }, function (error) {
                console.log(error);
            });

        });


    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function newPisCofins() {
    return {
        cumulativo: false,
        cst_entrada: '',
        cst_saida: '',
        aliquota_entrada: 0,
        aliquota_saida: 0
    }
}

function newIcmsEntrada() {
    return {
        uf: '',
        origem: '',
        cst: '',
        aliquota: 0,
        reducao: 0,
        tipo_mva: '',
        valor_mva: 0,
        inicio_mva: '',
        fim_mva: ''
    }
}

function newIcmsSaida() {
    return {
        uf: '',
        origem_destino: '',
        origem: '',
        cst: '',
        aliquota: 0,
        reducao: 0
    }
}

function newTributacaoMedia() {
    return {
        uf: '',
        aliq_nacional_fed: 0,
        aliq_importados_fed: 0,
        aliq_estadual: 0,
        chave: ''
    }
}

function newObservacao() {
    return {
        gtin: '',
        unidade: '',
        embalagem: 1,
        lastro: '',
        camada: '',
        comprimento: '',
        altura: '',
        largura: '',
        peso_bruto: '',
        peso_liquido: ''
    }
}

app.listen('3000', function () {
    console.log('Magic happens on port 3000');
});

exports = module.exports = app;