"use strict";

var $        = require('jquery');
var _        = require('underscore');

var businessRules    = require('./businessrules.js');
var errorview        = require('./errorview.js');
var HeaderUI         = require('./headerui.js');
var navigation       = require('./navigation.js');
const formsText = require('./localization/forms.tsx').default;
const commonText = require('./localization/common.tsx').default;


var tasks = [
    require('./welcometask.js'),
    require('./datatask.js'),
    require('./querytask.js'),
    require('./treetask.js'),
    require('./expresssearchtask.js'),
    require('./datamodeltask.js'),
    require('./attachmentstask.js'),
    require('./wbtask.js'),
    require('./wbimporttask.js'),
    require('./wbplantask.js'),
    require('./appresourcetask.js'),
    require('./components/lifemapperinfo').default,
];


    function handleUnexpectedError(event, jqxhr, settings, exception) {
        if (jqxhr.errorHandled) return; // Not unexpected.
        if (jqxhr.status === 403) {
            $(`<div>${formsText('sessionTimeOutDialogMessage')}</div>`)
                .appendTo('body').dialog({
                    title: formsText('sessionTimeOutDialogTitle'),
                    modal: true,
                    open: function(evt, ui) { $('.ui-dialog-titlebar-close', ui.dialog).hide(); },
                    buttons: [{
                        text: commonText('login'),
                        click: function() {
                            window.location = "/accounts/login/?next=" + window.location.href;
                        }
                    }]});
            return;
        }
        new errorview.UnhandledErrorView({jqxhr: jqxhr}).render();

        console.log(arguments);
    }

    module.exports = function appStart() {
        console.info('specify app starting');
        // addBasicRoutes(router);
        $(document).ajaxError(handleUnexpectedError);
        businessRules.enable(true);
        new HeaderUI().render();
        _.each(tasks, function(task) { task(); });

        // start processing the urls to draw the corresponding views
        navigation.start({pushState: true, root: '/specify/'});

        $('body').delegate('a.intercept-navigation', 'click', function(evt) {
            evt.preventDefault();
            var href = $(evt.currentTarget).prop('href');
            href && navigation.go(href);
        });
    };
