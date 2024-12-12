/**
 * @NApiVersion 2.0
 * @NModuleScope SameAccount
 */

/**
 * An input dialog utility to capture user input without injecting html scripts, derived from NetSuite-insights input dialog opensource utility.
 * @date    2022-05-24
 * @version 2.0.0
 *
 * v2.0.1   2022-05-11
 * Removed dependency on internal N/utilityFunctions module as it caused errors in some cases.
 *
 * v3.0.0  2023-08-14
 * Adjusted script functions to cater multiple type (select, text, textarea, number) fields instead of textarea only.
 *
 * v3.0.1  2024-03-20
 * Added multiple select option
 *
 * v3.0.2  2024-05-23
 * Added height and width option for input fields
 * Added CSS for custom scrollbar to show scrollbar buttons
 * Added return of labels for select fields.
 *
 * v3.0.3  2024-07-04
 * Adjusted script functions to cater date input type.
 *
 */

define(['N/error'],

    function(error) {

        const DEFAULT_BUTTON_LABEL = "OK";
        const DEFAULT_BUTTON_VALUE = true;

        function prepareOptions(options) {
            let title = "", message = "";
            if (options !== undefined)
            {
                title = options.hasOwnProperty("title") ? options.title : "";
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

        function doDialog(options, dialogType) {
            let finalOptions = prepareOptions(options);

            let creatorFunction;
            if (dialogType === 'dialog') {
                creatorFunction = NS.UI.Messaging.Dialog;
                finalOptions.buttons = craftButtons(options);
            } else if (dialogType === 'confirm') {
                creatorFunction = NS.UI.Messaging.Confirm;
            } else if (dialogType === 'alert') {
                creatorFunction = NS.UI.Messaging.Alert;
            }

            return new Promise(function (resolve, reject) {
                try {
                    finalOptions.onClose = function (event) {
                        let result = event.button.value;
                        // msg.reply = result;
                        // messageQueue.storeMessage(msg);
                        resolve(result);
                    };
                    let myDialog = new creatorFunction(finalOptions);
                    myDialog.open();
                }
                catch (e) {
                    reject(e);
                }
            });
        }

        /**
         * A utility class extending NetSuite's N/ui/dialog module with the ability to capture user input.
         * @exports NSI/InputDialog
         * @namespace InputDialog
         */
        function InputDialog(options) {
            let _options;

            _parseOptions(options);

            /// Private functions ////
            /*
             * A console.log wrapper. Only logs if the debug=t parameter is specified in the page's URL.
             * @param {*} val The value to be logged.
             */
            function _log(val) {
                // console.log(val);
                console.log(val);
                if ((window.location.search || '').toLowerCase().indexOf('debug=t') >= 0) {
                    console.log(val);
                }
            }

            function _prepareFields(options) {
                let rawFields;
                if ((options === undefined) || (options === null) || !options.hasOwnProperty("fields"))
                    rawFields = [];
                else
                    rawFields = options.fields;

                if (!util.isArray(rawFields)) {
                    //utilityFunctions.throwSuiteScriptError(error.Type.WRONG_PARAMETER_TYPE);
                    throw error.create({
                        name: 'WRONG_PARAMETER_TYPE',
                        message: 'Expected an array but got ' + typeof rawFields
                    });
                }

                return rawFields;
            }

            /*
             * Parses the inputs, setting up default values and performing validations as per specs.
             * @param {object} [input] The input dialog options to be parsed.
             */
            function _parseOptions(input) {
                _log('Options before processing: ' + JSON.stringify(input));
                let options = input;
                let invalidButtonValues = false;

                let fields = _prepareFields(options);
                // let fields = JSON.parse(JSON.stringify(options.fields));

                for (let i = 0; i < fields.length; i++) {
                    let field = {};
                    if (fields[i]) {
                        field = fields[i]; // Deep copy
                    }

                    if (field.type === 'textarea') {
                        let rows = parseInt(field.rows)
                        if (isNaN(rows) || rows <= 0) {
                            field.rows = 5;
                        }
                    }

                    if (field.type === 'number') {
                        if (field.step == null) {
                            field.step = '0.01';
                        }
                    }

                    if (field.type === 'text' || field.type === 'textarea' || field.type === 'number') {
                        let cols = parseInt(field.cols)
                        if (isNaN(cols) || cols <= 0) {
                            field.cols = 40;
                        }

                        if (field.placeholder == null) {
                            field.placeholder = '';
                        }
                    }
                    if (field.type === 'date') {
                        if (field.placeholder == null) {
                            field.placeholder = '';
                        }
                    }
                    //
                    // if (!Array.isArray(options.buttons) || options.buttons.length < 1) {
                    //     options.buttons = [{ label: DEFAULT_BUTTON_LABEL, value: DEFAULT_BUTTON_VALUE }];
                    // }


                    if (field.initialValue == null) {
                        field.initialValue = '';
                    }

                    if (field.isMandatory == null) {
                        field.isMandatory = false;
                    }

                    if (field.caption == null) {
                        field.caption = '';
                    }

                    if (field.isMandatory) {
                        if (field.caption === '') {
                            field.caption = 'Input field';
                        }

                        field.caption += ' *';
                    }

                    let actionButtons = field.actionButtons
                    if (!Array.isArray(actionButtons)) {
                        field.actionButtons = [];
                    } else {
                        // Make sure that the specified action buttons are valid.
                        let index, button;
                        let tmpArr = actionButtons.splice();
                        for (let j = 0; j < options.buttons.length; ++j) {
                            button = options.buttons[j]
                            index = tmpArr.indexOf(button.value)
                            _log('Button: ' + JSON.stringify(button) + ' | Action button index: ' + index)
                            if (index >= 0) {
                                tmpArr.splice(index, 1);
                            }
                        }

                        if (tmpArr.length !== 0) {
                            invalidButtonValues = true;
                            break;
                        }
                    }

                    options.fields[i] = field;
                }

                if (invalidButtonValues == true) {
                    throw 'The following action button(s) do not match any of the input button values: ' + JSON.stringify(tmpArr);
                }

                _log('Options after processing: ' + JSON.stringify(_options))
                _options = options;
            }

            /*
             * Custom event handler for button clicks, allowing us capture and process the additional inputs.
             * @param {Object} event
             */
            function _onClick(event) {
                let buttonId = event.button.value
                _log(arguments.callee.name + 'Button clicked! Value: ' + buttonId);

                let canClose = true;
                window.nsiInputFieldValues = [];

                for (let i = 0; i < _options.fields.length; i++) {
                    let text = '';
                    // Parse input only when clicked button is an action button.
                    if (_options.fields[i].actionButtons.length === 0 || _options.fields[i].actionButtons.indexOf(buttonId) >= 0) {
                        text = (jQuery("#nsi-inputdialog-" + _options.fields[i].fieldId).val().toString() || '').trim();
                        _log(arguments.callee.name + ' Text: ' + text + ' | options: ' + JSON.stringify(_options));

                        if (_options.fields[i].isMandatory && !text) {
                            canClose = false;
                        } else {
                            if (_options.fields[i].fieldId) {
                                nlapiSetFieldValue(_options.fields[i].fieldId, text);
                            }

                            // code block for select options
                            let field = _options.fields[i];
                            if (field.type == 'select' && field.returnText) {
                                let selected = [];
                                jQuery("#nsi-inputdialog-" + _options.fields[i].fieldId).find('option:selected').each(function(){
                                    selected.push({value: this.value, text: this.text});
                                });
                                text = selected.length > 0 ? JSON.stringify(selected) : '';
                            }
                            // Store the result in a global variable for access later.
                            window.nsiInputFieldValues.push(text);
                        }
                    }
                }


                if (canClose) {
                    event.dialog.close(event);
                } else {
                    // We use an alert here for a consistent experience as NetSuite uses this approach to validate mandatory fields.
                    alert("Please enter a value in the mandatory input text field/s.");
                }
            }

            /*
             * Generates HTML for the input dialog's text area.
             */
            function _buildBody() {
                let output = '';
                if (_options.message) {
                    output += '<p>' + _options.message + '</p><br/>';
                }

                for (let i = 0; i < _options.fields.length; i++) {
                    const field = _options.fields[i];
                    if (field.caption) {
                        output += '<span class="smallgraytext uir-label">'+ field.caption.toString().toUpperCase() + '</span><br/>';
                    }

                    if (field.type === 'textarea') {
                        output += '<textarea class="nsifields" id="nsi-inputdialog-'+field.fieldId+'" placeholder="' + field.placeholder + '" rows="' + field.rows + '" cols="' + field.cols + ' "style="width:' + (field.width ? field.width : '100%') + '; ' + (field.height ? 'height:' + field.height + ';' : '') + '">' + field.initialValue + '</textarea>';
                    } else if (field.type === 'text') {
                        output += '<input class="nsifields" type="text" id="nsi-inputdialog-' + field.fieldId + '" placeholder="' + field.placeholder + '" cols="' + field.cols + '" style="width:' + (field.width ? field.width : '100%') + '; ' + (field.height ? 'height:' + field.height + ';' : '') + '" />';
                    } else if (field.type === 'number') {
                        output += '<input class="nsifields" type="number" id="nsi-inputdialog-' + field.fieldId + '" placeholder="' + field.placeholder + '" cols="' + field.cols + '" step="' + field.step + '" style="width:' + (field.width ? field.width : '100%') + '; ' + (field.height ? 'height:' + field.height + ';' : '') + '" />';
                    } else if (field.type === 'date') {
                        output += '<input type="date" id="nsi-inputdialog-' + field.fieldId + '" placeholder="' + field.placeholder + '" ' + (field.min ? 'min="' + field.min + '"' : '') + (field.max ? 'max="' + field.max + '"' : '') + ' style="width:' + (field.width ? field.width : '100%') + '; ' + (field.height ? 'height:' + field.height + ';' : '') + '"/>';
                    } else if (field.type === 'select') {
                        let optionList = '';
                        for (let j = 0; j < field.options.length; j++) {
                            let fieldOption = field.options[j];
                            optionList += '<option value=' + fieldOption.value + ' ' + (fieldOption.selected ? 'selected' : '') + '>' + fieldOption.label + '</option>';
                        }
                        output += '<select class="nsifields" id="nsi-inputdialog-' + field.fieldId + '" style="width:' + (field.width ? field.width : '100%') + '; ' + (field.height ? 'height:' + field.height + ';' : '') + '"' + (field.isMultiple ? ' multiple' : '') + '>' + optionList + '</select>';
                    }

                    // for custom scroll bar as the new version does not have buttons
                    const addCSS = css => document.head.appendChild(document.createElement("style")).innerHTML=css;

                    addCSS(`.nsifields::-webkit-scrollbar {
                        width: 16px;
                        height: 16px;
                    }
                    
                    .nsifields::-webkit-scrollbar-corner,
                    .nsifields::-webkit-scrollbar-track {
                        background-color:#eee;
                    }
                    
                    .nsifields::-webkit-scrollbar-thumb {
                        background-color: #8f8e8e;
                        background-clip: padding-box;
                        border: 2px solid transparent;
                    }
                    
                    .nsifields::-webkit-scrollbar-thumb:hover {
                        background-color: rgb(112, 112, 112);
                    }
                    
                    .nsifields::-webkit-scrollbar-thumb:active {
                        background-color: rgb(128, 128, 128);
                    }
                    
                    /* Buttons */
                    .nsifields::-webkit-scrollbar-button:single-button {
                        background-color: #eee;
                        display: block;
                        background-size: 10px;
                        background-repeat: no-repeat;
                    }
                    
                    /* Up */
                    .nsifields::-webkit-scrollbar-button:single-button:vertical:decrement {
                        height: 12px;
                        width: 16px;
                        background-position: center 4px;
                        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='rgb(73, 73, 73)'><polygon points='50,00 0,50 100,50'/></svg>");
                    }
                    
                    .nsifields::-webkit-scrollbar-button:single-button:vertical:decrement:hover {
                        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='rgb(112, 112, 112)'><polygon points='50,00 0,50 100,50'/></svg>");
                    }
                    
                    .nsifields::-webkit-scrollbar-button:single-button:vertical:decrement:active {
                        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='rgb(128, 128, 128)'><polygon points='50,00 0,50 100,50'/></svg>");
                    }
                    
                    /* Down */
                    .nsifields::-webkit-scrollbar-button:single-button:vertical:increment {
                        height: 12px;
                        width: 16px;
                        background-position: center 2px;
                        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='rgb(73, 73, 73)'><polygon points='0,0 100,0 50,50'/></svg>");
                    }
                    
                    .nsifields::-webkit-scrollbar-button:single-button:vertical:increment:hover {
                        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='rgb(112, 112, 112)'><polygon points='0,0 100,0 50,50'/></svg>");
                    }
                    
                    .nsifields::-webkit-scrollbar-button:single-button:vertical:increment:active {
                        background-image`);
                    output += '<br/>';
                }

                _options.data

                return output;
            }


            /// Privileged functions ///
            /*
            * Creates the actual input dialog including the HTML used to decorate the native
            * NetSuite dialog with input capturing capabilities.
            */
            this.build = function () {
                let htmlMessage = _buildBody();

                // Inject a custom click listener for each button
                for (let i = 0; i < _options.buttons.length; ++i) {
                    _options.buttons[i].onClick = _onClick;
                }

                _log(htmlMessage);
                let options = {
                    title: _options.title,
                    message: htmlMessage,
                    buttons: _options.buttons
                };
                _log(options);
                return options;
            }
        }

        /**
         * Creates an input dialog with the specified options.
         * @memberof InputDialog
         * @method create
         *
         * @param {Object} [options] Configuration options for the input dialog.
         * @param {string} [options.title] The dialog title. Defaults to an empty string.
         * @param {string} [options.message] Text to be displayed about the input field. Defaults to an empty string.
         * @param {object[]} [options.buttons] A list of buttons to be included in the dialog.
         *        Each item in the button list must be an object that contains a label and a value property.
         By default, a single button with the label OK and the value 1 is used.
         * @param {Object} [options.fields] The configuration for the input fields. Currently, this extension can generate select, text, textarea, date, and number input type fields.
         * @param {string} [options.fields.type] The type of input of the field. Can be select, text, textarea, date, or number.
         * @param {string} [options.fields.height] The input text area's default height expressed in CSS styling format. Sample: 5px, 100%
         * @param {string} [options.fields.width] The input text area's default height expressed in CSS styling format. Sample: 5px, 100%
         * @param {number} [options.fields.rows] The input text area's default height expressed in rows. Defaults to 5.
         * @param {number} [options.fields.cols] The input text area's default width expressed in columns. Defaults to 40. A value above 50 is NOT recommended.
         * @param {boolean} [options.fields.isMandatory] Indicates whether user input is mandatory.
         *        If true and the user presses an action button without entering any input, an alert popup will be shown and the input dialog will stay open. Defaults to false.
         * @param {string} [options.fields.caption] The caption to show above the input text area. Defaults to 'Input field *' if isMandatory = true; omitted otherwise.
         * @param {string} [options.fields.initialValue] The initial value to be displayed in the input text area. Defaults to an empty string.
         * @param {string} [options.fields.fieldId] The ID of the field on the current page to which the user input should be written upon closing the Input dialog using any of the action buttons.
         *        If specified, in addition to writing the text to this field, the text will still be passed to the success callback function if provided.
         * @param {string} [options.fields.placeholder] The placeholder value specifies a short hint that describes the expected value of an input field.
         * @param {number} [options.fields.step] The step attribute is used for Input type "number" fields, it specifies the interval between legal numbers in an <input> element. Only available for number input types.
         *        Defaults to '0.01' if not specified.
         * @param {string} [options.fields.min] The min attribute is used for Input type "date" fields, it specifies the minimum selectable date. Format for date: YYYY-MM-DD
         * @param {string} [options.fields.max] The max attribute is used for Input type "date" fields, it specifies the maximum selectable date. Format for date: YYYY-MM-DD
         * @param {boolean} [options.fields.selected] The previously selected value for the select input type.
         * @param {boolean} [options.fields.returnText] The returned value of the select input type. If true, the label of the option will also be returned, else, will return only the values.
         * @param {boolean} [options.fields.isMultiple] Indicate the type of select input. If true, the select input type will be a multi-select.
         * @param {object[]} [options.fields.options] A list of label and value pairs that will be the options for select input types.
         * @param {int[]} [options.fields.actionButtons] A list of buttons (value properties only) that will trigger validation and persisting the input.
         *        Defaults to all buttons added to the input dialog. Using this option, the cancel button can be excluded as an action button, enabling it to
         *        be used to close an input dialog without providing input.
         * @param {function} [success] A callback function to be executed (asynchronously) when the dialog is closed.
         *        It will be passed two parameters: (1) The value of the button pressed and (2) the input entered by the user.
         * @param {function} [failure] A callback function to be executed (asynchronously) if anything goes wrong.
         *        It simply forward whatever NetSuite's native dialog.create() passes into the catch portion of the Promise object.
         */
        function create(options, success, failure) {
            doDialog(new InputDialog(options).build(), 'dialog')
                .then(function(result) {
                    if (success) {
                        success(result, window.nsiInputFieldValues)
                    }
                })
                .catch(function(reason) {
                    if (failure) {
                        failure(reason)
                    }
                });
        }

        return {
            create: create
        }
    });
