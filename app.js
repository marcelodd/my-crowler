var express = require('express');
var fs = require('fs');
var request = require('request').defaults({ jar: true });
var cheerio = require('cheerio');
var app = express();

app.get('/scrape', function (req, res) {

    if (!app.get('isAuthenticate')) {
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
                //var set_cookie = response.headers['set-cookie'][0].split(/\s*;\s*/);
                /*var __cfduid = set_cookie[0].substring(9);
                var expires = set_cookie[1].substring(8);

                var j = request.jar();
                var cookie = request.cookie(response.headers['set-cookie']);*/
                app.set('isAuthenticate', true);
            });
        }, function (error) {
            console.log(error);
        });
    } else {
        pesquisar('7891000012109', function (result) {
            res.status(200).json(result);
        }, function (error) {

        });
    }

    /*urlSignin = 'http://cosmos.bluesoft.com.br/users/sign_in';

    request(url, function (error, response, html) {
        if (!error) {
            var $ = cheerio.load(html);

            var title, release, rating;
            var json = { title: "", release: "", rating: "" };

            var fruits = [];

            $('.quicksearch_dropdown_wrapper').children('select').children().each(function(i, elem) {
                fruits[i] = $(this).text();
            });

            fruits.join(', ');

            console.log(fruits);

            $('.star-box-giga-star').filter(function () {
                var data = $(this);
                rating = data.text();

                json.rating = rating;
            })
        }

        // To write to the system we will use the built in 'fs' library.
        // In this example we will pass 3 parameters to the writeFile function
        // Parameter 1 :  output.json - this is what the created filename will be called
        // Parameter 2 :  JSON.stringify(json, null, 4) - the data to write, here we do an extra step by calling JSON.stringify to make our JSON easier to read
        // Parameter 3 :  callback function - a callback function to let us know the status of our function

        fs.writeFile('output.json', JSON.stringify(json, null, 4), function (err) {

            console.log('File successfully written! - Check your project directory for the output.json file');

        })

        // Finally, we'll just send out a message to the browser reminding you that this app does not have a UI.
        res.send('Check your console!')

    });*/


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
    request('http://cosmos.bluesoft.com.br/pesquisar?utf8=true&q=' + gtin, function (error, response, html) {
        if (!error) {
            successCallback(tranformHTML(html));
        } else {

        }
    });
}

function tranformHTML(html) {
    var $ = cheerio.load(html);

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

    $(tab_content + ' #figura-502-federal')
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
            _pis.aliquota_saida   = parseFloat($(this).children('tr').children('td')[3].children[0].data.replace(',', '.').substring(0, 4));
            
            _cofins.aliquota_entrada = parseFloat($(this).children('tr').children('td')[4].children[0].data.replace(',', '.').substring(0, 4));
            _cofins.aliquota_saida   = parseFloat($(this).children('tr').children('td')[5].children[0].data.replace(',', '.').substring(0, 4));

            pis.push(_pis);
            cofins.push(_cofins);
        });

        return {
            descricao: descricao,
            ncm: ncm,
            cest: cest,
            pis: pis,
            cofins: cofins
        };
}

function newPisCofins(){
    return {
        cumulativo: false,
        cst_entrada: '',
        cst_saida: '',
        aliquota_entrada: 0,
        aliquota_saida:0
    }
}

app.listen('3000', function () {
    console.log('Magic happens on port 3000');
});

exports = module.exports = app;