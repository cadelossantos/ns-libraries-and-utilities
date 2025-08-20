/**
 * @NApiVersion 2.0
 * @NModuleScope SameAccount
 */

/**
 * An output dialog utility to display the backend process tasks progress
 * @date    2024-03-27
 * @version 1.0.0
 *
 * v1.0.1   2024-04-08
 * Added redirect to url functionality
 *
 * v1.0.2   2024-07-31
 * Removal of option.external for https.requestSuitelet due to 2024.2 Update
 *      https.requestSuitelet now works for both external and internal without setting the option
 *
 * v1.0.3   2024-09-30
 * added non-closable option and catching of status if failed.
 * 
 * v1.0.4   2025-08-20
 * added enhancements to progress loader
 *      added header content type to https.requestSuitelet to not include the body in urlparams when request is sent to the Suitelet
 */

define(['N/error', 'N/https'],

    function(error, https) {

        const DEFAULT_TITLE = 'Processing..';
        const DEFAULT_BUTTON_LABEL = 'Close';
        const DEFAULT_BUTTON_VALUE = 1;
        let myDialog = null;

        /*
         * A console.log wrapper. Only logs if the debug=t.
         * @param {*} val The value to be logged.
         */
        function _log(val) {
            let isDebug = true;
            if (isDebug) console.log(val);
        }

        function prepareOptions(options) {
            let title = "", message = "";
            if (options !== undefined)
            {
                title = options.hasOwnProperty("title") ? options.title : DEFAULT_TITLE;
                message = options.hasOwnProperty("message") ? options.message : "";
            }

            return {title: title, message: message};
        }

        function prepareButtons(options) {
            let rawButtons;
            if ((options === undefined) || (options === null) || !options.hasOwnProperty("buttons"))
                rawButtons = [];
            else
                rawButtons = options.buttons;

            if (!util.isArray(rawButtons)) {
                //utilityFunctions.throwSuiteScriptError(error.Type.WRONG_PARAMETER_TYPE);
                throw error.create({
                    name: 'WRONG_PARAMETER_TYPE',
                    message: 'Expected an array but got ' + typeof rawButtons
                });
            }

            if (rawButtons.length === 0)
                rawButtons = [{label: DEFAULT_BUTTON_LABEL, value: DEFAULT_BUTTON_VALUE}];

            return rawButtons;
        }

        function craftButtons(options) {
            let buttons = prepareButtons(options);
            let buttonList = [];

            for (let i = 0; i < buttons.length; i++) {
                let thisButton = buttons[i];
                if (!thisButton.hasOwnProperty("label") || !thisButton.hasOwnProperty("value")) {
                    throw error.create({
                        name: 'BUTTONS_MUST_INCLUDE_BOTH_A_LABEL_AND_VALUE',
                        message: 'Buttons must include both a label and value.'
                    });
                }

                buttonList.push(new NS.UI.Messaging.Button({
                    label: thisButton.label,
                    value: thisButton.value,
                    onClick: thisButton.onClick /* <-- NSI insertion */ || function (event) { event.dialog.close(event); }
                }));
            }
            return buttonList;
        }

        function doDialog(options) {
            let finalOptions = prepareOptions(options);

            let creatorFunction;
            creatorFunction = NS.UI.Messaging.Dialog;
            // creatorFunction = NS.UI.Messaging.Progress;
            finalOptions.buttons = options.buttons.length > 0 ? craftButtons(options) : [];
            // _log('options test ' + JSON.stringify(options));

            myDialog = new creatorFunction(finalOptions);
            myDialog.closable = false;
            myDialog.open();
        }

        function progressUpdater(options) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    try {
                        let res = https.requestSuitelet({
                            scriptId: options.suiteletScriptId,
                            deploymentId: options.suiteletDeploymentId,
                            body: JSON.stringify({
                                otherparams: options.otherparams,
                                mrTaskId: options.mrTaskId
                            }),
                            headers: { 'Content-Type': 'application/json' },
                            method: 'POST'
                        });

                        let httpBody = JSON.parse(res.body);

                        options.mrTaskId = httpBody.mrTaskId;
                        options.status = httpBody.status;
                        options.stage = httpBody.stage;
                        options.pendingCount = httpBody.pendingCount;
                        options.totalCount = httpBody.totalCount;
                        options.processedCount = options.totalCount - options.pendingCount;
                        options.percentage = httpBody.percentage;

                        _log('progressUpdater status: ' + options.status);

                        // Update progress in the dialog
                        jQuery('#nsoutput_status').html('Status: <b>' + (options.status == null ? '' : options.status) + '</b>');
                        jQuery('#nsoutput_stage').html('Stage: <b>' + (options.stage == null ? '' : options.stage) + '</b>');
                        jQuery('#nsoutput_percentage').html(options.percentage + '%');
                        jQuery('#nsoutput_count').html(options.processedCount + ' of ' + options.totalCount);
                        jQuery('#nsoutput_progressbar').css('width', options.percentage + "%");

                        if (options.status === 'COMPLETE') {
                            options.percentage = 100;
                            resolve();
                        } else if (options.status === 'FAILED') {
                            reject('Backend processing has failed.');
                        } else {
                            progressUpdater(options).then(resolve).catch(reject);
                        }
                    } catch (e) {
                        reject('An error occurred during progress update: ' + e.message);
                    }
                }, 1000);
            });
        }

        /**
         * A utility class extending NetSuite's N/ui/dialog module with the ability to capture background task status.
         * @exports NS/OutputDialog
         * @namespace OutputDialog
         */
        function OutputDialog(options) {
            let _options;

            _parseOptions(options);

            /// Private functions ////
            /*
             * Parses the output, setting up default values and performing validations as per specs.
             * @param {object} [output] The output dialog options to be parsed.
             */
            function _parseOptions(output) {
                // _log('Options before processing: ' + JSON.stringify(output));
                let options = output;

                if (typeof options.closable === 'undefined') options.closable = true;

                if (options.closable) {
                    options.buttons = [{ label: DEFAULT_BUTTON_LABEL, value: DEFAULT_BUTTON_VALUE }];
                } else {
                    options.buttons = [];
                }

                options.mrTaskId = options.mrTaskId ? options.mrTaskId : '';
                options.status = options.status ? options.status : '';
                options.stage = options.stage ? options.stage : '';
                options.pendingCount = options.pendingCount ? options.pendingCount : 0;
                options.totalCount = options.totalCount ? options.totalCount : 0;
                options.processedCount = options.processedCount ? options.processedCount : 0;
                options.percentage = options.percentage ? options.percentage : 0;
                // _log('Options after processing: ' + JSON.stringify(options));
                _options = options;
            }

            /*
             * Generates HTML for the output dialog's progress loader.
             */
            function _buildBody(){
                // _options.percentage = 50;

                let output = `<html lang="en">
                                <head>
                                    <meta charset="utf-8">
                                    <!-- <meta name="viewport" content="width=device-width, initial-scale=1"> -->
                                    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.0/css/bootstrap.min.css">
                                    <style type="text/css">
                                    /* .uir-message-buttons{margin-top: 15px;} */
                                    .progress.active .progress-bar {
                                        -webkit-transition: none !important;
                                        transition: none !important;
                                    }
                                    .center {
                                        margin-left: auto;
                                        margin-right: auto;
                                    }
                                    /* Custom gradient active progress bar */
                                    #nsoutput_progressbar {
                                        background: linear-gradient(
                                            270deg,
                                            #0f8cf9ff 25%,
                                            #8ef3f8ff 50%,
                                            #0f8cf9ff 75%
                                        );
                                        background-size: 200% 100%;
                                        animation: gradientSlide 3s linear infinite;
                                    }

                                    @keyframes gradientSlide {
                                        0%   { background-position: 100% 50%; }
                                        100% { background-position: 0% 50%; }
                                    }
                                    </style>
                                </head>
                                <body>
                                    <div style="height: 55px;">
                                    <!-- <br/><br/><br/><br/> -->
                                    
                                    <!--<div class="center" style="display: table; width: 50%;">
                                        <h1 style="font-size: 18px; text-align: center; font-weight: bold; color: #4D5F79;"> ${_options.title}</h1></br>
                                    </div>-->
                                    
                                    <div class="center" style="display: table; width: 100%;">
                                        <span id="nsoutput_status" style="float:left; font-size: 12px;">Status: <b>${_options.status}</b></span>
                                        <span id="nsoutput_stage" style="float:right; font-size: 12px;">Stage: <b>${_options.stage}</b></span>
                                    </div>
                                    <div class="center" style="display: table; width: 100%;">
                                        <span id="nsoutput_percentage" style="float:left; font-size: 12px;">${_options.percentage}%</span>
                                        <span id="nsoutput_count" style="float:right; font-size: 12px;">${_options.processedCount} of ${_options.totalCount}</span>
                                    </div>
                                    <div style="display: table; width: 100%;" class="center progress-container">
                                        <div class="progress progress-striped active" style="margin-bottom: 0 !important;">
                                            <div id="nsoutput_progressbar" class="progress-bar progress-bar-info"
                                                style="width: ${_options.percentage}%;">
                                            </div>
                                        </div>
                                    </div>
                                    </div>
                                </body>
                                </html>`;

                return output;
            }

            /*
             * Custom event handler for button clicks, allowing us capture and process the additional inputs.
             * @param {Object} event
             */
            function _onClick(event) {
                let buttonId = event.button.value;
                _log(arguments.callee.name + 'Button clicked! Value: ' + buttonId);
                // event.dialog.close(event);

                if (_options.redirectTo) {
                    window.location = _options.redirectTo;
                } else {
                    window.location.reload();
                }
            }

            /// Privileged functions ///
            /*
            * Creates the actual output dialog including the HTML used to decorate the native
            * NetSuite dialog with input capturing capabilities.
            */
            this.build = function () {
                let htmlMessage = _buildBody();
                for (let i = 0; i < _options.buttons.length; ++i) {
                    _options.buttons[i].onClick = _onClick;
                }

                // _log(htmlMessage);
                let options = {
                    title: _options.title,
                    message: htmlMessage,
                    buttons: _options.buttons,
                    params: _options
                };
                // _log(options);
                return options;
            }
        }

        /**
         * Creates an output dialog with a progress bar.
         * @memberof OutputDialog
         * @method create
         *
         * @param {Object} [options] Configuration options for the input dialog.
         * @param {string} [options.title] The dialog title. Defaults to an empty string.
         * @param {string} [options.message] Text to be displayed about the input field. Defaults to an empty string.
         * @param {string} [options.mrTaskId] Generated string when an Map/Reduce task is created.
         * @param {string} [options.closable] Removes the Close button. When set to false, will close after 5 seconds if the backend processed is complete or failed. options.redirectTo can be empty when set to true.
         * @param {string} [options.redirectTo] The URL for the dialog to redirect to upon close. When empty, will reload the page instead.
         * @param {string} [options.status] Status of the task created. This will show if the task is still pending, processing, completed or failed.
         * @param {string} [options.stage] Stage of the task created. This will show what stage is currently being executed (i.e. GET_INPUT, MAP, REDUCE, SUMMARIZE)
         * @param {string} [options.pendingCount] This will show the pending number of data to be executed. Count is defined by stage.
         * @param {string} [options.totalCount] This will show the total number of expected executions. Count is defined by stage.
         * @param {string} [options.processedCount] The number of data that has been executed. Computed by the number of total count and pending count.
         * @param {string} [options.percentage] Percentage of task completion, value populated by taskStatus.getPercentageCompleted().
         * @param {string} [options.suiteletScriptId] The custom internal ID of the suitelet where the status is being checked from.
         * @param {string} [options.suiteletDeploymentId] The custom internal ID of the suitelet deployment where the status is being checked from.
         * @param {Object} [options.otherparams] Other parameters needed for the callSuitelet POST method to function.
         */
        function create(options) {
            return new Promise((resolve, reject) => {
                try {
                    doDialog(new OutputDialog(options).build());
                    progressUpdater(options)
                        .then(() => {
                            if (!options.closable) {
                                setTimeout(() => {
                                    myDialog.close();
                                }, 3000);
                                resolve('complete');
                            }
                        })
                        .catch((error) => {
                            console.log(error);
                            if (!options.closable) {
                                setTimeout(() => {
                                    myDialog.close();
                                    reject(error);
                                }, 3000);
                            }
                        });
                } catch (e) {
                    reject(e)
                }
            });
        }

        /**
         * @memberof OutputDialog
         * @method statusCheck
         *
         * @param {module} [taskModule] The N/task module for this client script to be able to check the task status.
         * @param {string} [mrTaskId] Generated string when an Map/Reduce task is created.
         * @param {string} [suiteletScriptId] The custom internal ID of the suitelet where the status is being checked from.
         * @param {string} [suiteletDeploymentId] The custom internal ID of the suitelet deployment where the status is being checked from.
         */
        function statusCheck(taskModule, mrTaskId, suiteletScriptId, suiteletDeploymentId) {
            let taskStatus = taskModule.checkStatus(mrTaskId);
            let status = taskStatus.status;
            let stage = taskStatus.stage;
            let pendingCount = 0;
            let totalCount = 0;
            let processedCount = 0;

            if (stage == 'MAP') {
                pendingCount = taskStatus.getPendingMapCount();
                totalCount = taskStatus.getTotalMapCount();
                processedCount = totalCount - pendingCount;
            } else if (stage == 'REDUCE') {
                pendingCount = taskStatus.getPendingReduceCount();
                totalCount = taskStatus.getTotalReduceCount();
                processedCount = totalCount - pendingCount;
            }
            let percentage = taskStatus.getPercentageCompleted();

            return {
                mrTaskId: mrTaskId,
                status: status,
                stage: stage,
                pendingCount: pendingCount,
                totalCount: totalCount,
                processedCount: processedCount,
                percentage: percentage,
                suiteletScriptId: suiteletScriptId,
                suiteletDeploymentId: suiteletDeploymentId
            };
        }

        return {
            create: create,
            statusCheck: statusCheck
        }
    });
