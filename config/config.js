/*global process module*/

var stagingSettings, productionSettings;
var settings = {};
stagingSettings = {
    servicenow: "",
    servicenowauthorization: "",
    servicenowsysid: "",
    bucket: "",
    buckettoken: "",
    reportname: "report.html",
    bucketreportname: "report_{DATE}.html"
};
productionSettings = {

};
switch (process.env.NODE_ENV) {
case 'staging':
    settings = Object.assign(settings, stagingSettings);
    break;
case 'production':
    settings = Object.assign(settings, productionSettings);
    break;
default:
    settings = Object.assign(settings, stagingSettings);
}

module.exports = {
    settings
  };