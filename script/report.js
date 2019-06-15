var pretty = require('pretty');
var _ = require('lodash');
const fetch = require('node-fetch');
var fs = require('fs');
var createHTML = require('create-html');
const request = require('request').defaults({strictSSL: false});
const moment = require('moment');
var path = require('path');
var config= require('../config/config');
const log4js = require('log4js');

log4js.configure({
  appenders: { chronic: { type: 'file', filename: 'chronicreport.log' } },
  categories: { default: { appenders: ['chronic'], level: 'debug' } }
});
const logger = log4js.getLogger(`ChronicReport-${new Date()}`);

var tableHtml = "";
var date = new Date();

function connectToServicenow(){
    logger.info(`Fetching data from - ${config.settings.servicenow}`);
    console.log("fetching from " + config.settings.servicenow);
    return fetch(config.settings.servicenow,{
        headers: {
          'Authorization': config.settings.servicenowauthorization
        }
      }).then(response=>{
          var data = response;
           logger.debug("Received data from the ServiceNow");
          return data.json();
      })
}

function fetchContents(contents){
 return new Promise(function(resolve, reject) { 
    logger.debug("Iterating through the 'result' array of objects to be displayed in table");
    _.forEach(contents.result,function(value,key){
      // logger.debug("Ticket Numbers: " + value.number);
      tableHtml = tableHtml+'<tr>'+    
      '<td>'+'<a href ='+config.settings.servicenowsysid+value.sys_id+'<a target="_blank">'+value.number+'</a>'+'</td>'+
      '<td>'+value.u_related_incidents+'</td>'+
      '<td>'+value.cmdb_ci.display_value+'</td>'+
      '<td>'+value.short_description+'</td>'+
      '<td>'+value.company.display_value+'</td>'+
      '</tr>';
    })
    resolve();
 })
}

function createReport(){
  return new Promise(function(resolve, reject) { 
   var html = createHTML({
    title: "Offender Configuration Items - " + (new Date().toUTCString()),
      scriptAsync: true,
      css: '',
      script: '',
      lang: 'en',
      dir: 'ltr',
      head: '<meta charset="utf-8">'+
      '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">'+
      '<meta name="description" content="">'+
      '<meta name="author" content="">'+
      '<link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.12/css/all.css" integrity="sha384-G0fIWCsCzJIMAVNQPfjH08cyYaUtMwjJwqiRKxxE/rx96Uroj1BtIQ6MLJuheaO9" crossorigin="anonymous">'+
      '<link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.1.1/css/bootstrap.min.css" integrity="sha384-WskhaSGFgHYWDcbwN70/dfYBj47jz9qbsMId/iRN3ewGhXQFZCSftd1LZCfmhktB" crossorigin="anonymous">'+
      '<style>'+
      'html {position: relative; min-height: 100%;}'+
      'body {margin-bottom: 60px; /* Margin bottom by footer height */}'+
      '.footer {position: absolute; bottom: 0; width: 100%; height: 60px;  line-height: 60px;  background-color: #f5f5f5;}'+
      '.container {width: auto; min-width: 992px; padding: 0 15px;}'+
      '</style>',
      body: '<main role="main" class="container">'+
      '<h1 class="mt-5">'+ 'Chronic devices with same symptoms repeating for more than 5 times in 24hrs.'+'</h1>'+
      '<div class="alert alert-primary" role="alert">Note: Count of duplicate tickets mentioned in summary and number of related incidents might vary</div>'+
      '<table class="table table-hover">'+
          '<thead>'+
          '<th scope="col">Number</th>'+ 
          '<th scope="col">Related Incidents</th>'+ 
          '<th scope="col">Configuration Item</th>'+ 
          '<th scope="col">Summary</th>'+
          '<th scope="col">Company</th>'+
          '</thead>'+
          '<tbody>'+ 
          tableHtml +    
          '</tbody>'+
      '</table>'+
      '</main>'+
      '<footer class="footer">'+
          '<div class="container">'+
              '<span class="text-muted">Report Generated: '+date.toUTCString()+
              '</span>'+
              '<br>'+
              '<span class="text-muted">Chronic Group Report</span>'+
          '</div>'+
      '</footer>'    
    })
    resolve(html);
  })
}

function generateReport(html){
   return new Promise(function(resolve, reject) {
      try{
          if(html){
              logger.debug("Report is being generated...");
              var writepath = path.join(__dirname, config.settings.reportname)
              fs.writeFile(writepath, pretty(html), function (err) {
                logger.debug(`Report is generated at ${writepath}`);
                if (err) {
                  logger.error(err)
                  reject()
                } 
                resolve();
              })
          }        
      }catch(err){
          logger.debug(err);
          reject(err);
      }
   })
}

function uploadReport(){
    var bucketreportname = config.settings.bucketreportname.replace('{DATE}',moment().format('Do_MMMM_YYYY'));
    var fullpath = path.join(__dirname, config.settings.reportname)
    console.log("bucketreportname :" + bucketreportname);
    console.log("fullpath :" + fullpath);
    const completeUrl = config.settings.bucket+`${bucketreportname}`;
    console.log("upload url :" + completeUrl);
    logger.debug(`bucket URL: ${completeUrl}`);
    const options = {
      method: 'PUT',
      url: completeUrl,
      qs: {token:config.settings.buckettoken},
      headers: {
        'X-bucket-Meta-Report-Description': `Uploading sample html file via bucket`,
        'X-bucket-Meta-Report-Day': moment().format('DD'),
        'X-bucket-Meta-Report-Month': moment().format('MM'),
        'X-bucket-Meta-Report-Year': moment().format('YYYY')
      }
    };
            
    return new Promise(function(resolve, reject) {
      fs.createReadStream(fullpath).pipe(request(options, function(error, response, body){
        logger.debug("Uploading Report to bucket");
        if (error) logger.error(error)
        logger.debug(body,"file has been uploaded successfully");
        resolve(body);
      }));
    });
}

connectToServicenow()
.then(contents=>fetchContents(contents))
.then(createReport)
.then(generateReport)
//.then(uploadReport)
.catch(err=> {
  logger.error(err)
});