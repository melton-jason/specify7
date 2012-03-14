require({
    priority: ['jquery'],
    paths: {
        'jquery': "https://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery",
        'jquery-ui': "https://ajax.googleapis.com/ajax/libs/jqueryui/1.8.16/jquery-ui.min"
    }
});

require(
    ['jquery', 'populateform', 'specifyform', 'schemalocalization', 'putform'],
    function ($, populateform, specifyform, schemalocalization, putform) {
        "use strict";

        $(function () {
            var rootContainer = $('#specify-rootform-container');
            var params = populateform.pullParamsFromDl(rootContainer);
            var form = specifyform.buildViewForModel(params.relatedModel);
            form.children('input[value="Delete"]').remove();
            schemalocalization.localizeForm(form);
            populateform.setupControls(form);
            rootContainer.empty().append(form);

            function postForm() {
                var data = putform.harvestForm(form.find('.specify-view-content')),
                uri = '/api/specify/' + params.relatedModel.toLowerCase() + '/';
                data[params.model.toLowerCase()] = '/api/specify/' + params.model.toLowerCase() + '/' + params.id + '/';
                data.version = 0;
                return $.ajax(uri, {
                    type: 'POST',
                    contentType: 'application/json',
                    processData: false,
                    data: JSON.stringify(data)
                }).promise();
            };

            $('input[type="submit"]').click(function () {
                var btn = $(this);
                btn.prop('disabled', true);
                postForm().done(function () {
                    window.location = '../../';
                });
            });
        });
    });
