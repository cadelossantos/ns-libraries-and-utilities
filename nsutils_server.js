/**
 * @NApiVersion 2.1
 */
define(['N/record', 'N/search', 'N/task', 'N/ui/message'],
	(record, search, task, message) => {

		/**
		 * Displays a banner message on the form if there is a background task in progress, with information on the status of the task.
		 *
		 * @param form
		 * @param taskId
		 * @param msgTitle
		 */
		const showBackgroundTaskBanner = (form, taskId, msgTitle) => {
			let taskStatus = task.checkStatus({
				taskId: taskId
			});
			let pending = taskStatus.getPendingMapCount();
			let total = taskStatus.getTotalMapCount();
			let stage = taskStatus.stage;
			let status = taskStatus.status;
			let processed = total - pending;

			if (status == 'PENDING' || stage == 'GET_INPUT') {
				form.addPageInitMessage({
					type: message.Type.INFORMATION,
					title: msgTitle,
					message: 'Asynchronous back-end process running.<br />Status: ' + status + '<br />Click <a href="javascript:window.location.href=window.location.href">refresh</a> to check status.'
				});
			} else if(stage == 'MAP' && pending > 0) {
				form.addPageInitMessage({
					type: message.Type.INFORMATION,
					title: msgTitle,
					message: 'Asynchronous back-end process running.<br />Status: ' + processed + ' of ' + total + ' item(s) completed.<br />Click <a href="javascript:window.location.href=window.location.href">refresh</a> to check status.'
				});
			} else if(status == 'PROCESSING') {
				form.addPageInitMessage({
					type: message.Type.INFORMATION,
					title: msgTitle,
					message: 'Asynchronous back-end process running.<br />Status: Processing...' + '<br />Click <a href="javascript:window.location.href=window.location.href">refresh</a> to check status.'
				});
			} else if(stage == 'SUMMARIZE') {
				form.addPageInitMessage({
					type: message.Type.INFORMATION,
					title: msgTitle,
					message: 'Asynchronous back-end process running.<br />Status: Finishing-up' + '<br />Click <a href="javascript:window.location.href=window.location.href">refresh</a> to check status.'
				});
			}
		}

		/**
		 * Attempts to create and execute a scheduled script task with the provided parameters.
		 * If the task creation fails due to no available deployments, it will automatically create a script deployment for the specified script and retry creating and executing the task.
		 * Optionally, it can also log the generated taskId or any error message back to a specified record.
		 *
		 * @param taskParams - Parameters to create and execute a script task
		 * @param taskParams.taskType - Type of the task to create; use values from the task.TaskType enum
		 * @param taskParams.scriptId - Script ID of the script to execute in the scheduled script task
		 * @param taskParams.scriptParams - Parameters to pass to the scheduled script, in the form of an object with key-value pairs
		 * @param recordLogParams - Optional parameters to log taskId and error message back to a record
		 * @param recordLogParams.recordId - Internal ID of the record to log back to
		 * @param recordLogParams.recordType - Record type of the record to log back to
		 * @param recordLogParams.taskIdFld - Field ID of the field to log taskId to
		 * @param recordLogParams.taskErrorFld - Field ID of the field to log error message to
		 * @return {{data: string, success: boolean, message: string}}
		 */
		const executeScriptTaskAndAutoGenDeployment = (taskParams, recordLogParams = {}) => {
			let { taskType, scriptId, scriptParams} = taskParams;
			let { recordId = null, recordType = null, taskIdFld = null, taskErrorFld = null} = recordLogParams;

			let response = {
				data: '',
				success: false,
				message: ''
			}

			let taskId = null;

			try {
				try {
					let taskObj = task.create({
						taskType: taskType,
						scriptId: scriptId,
						params: scriptParams
					});
					taskId = taskObj.submit();
				} catch (e) {
					if (e.name === 'NO_DEPLOYMENTS_AVAILABLE') {
						let mrId = null;
						let scriptSearchObj = search.create({
							type: "script",
							filters: [ ["scriptid","is",scriptId] ],
							columns: [ "internalid" ]
						});
						scriptSearchObj.run().each(function(result){
							mrId = result.getValue('internalid');
							return true;
						});

						if (mrId) {
							let scriptDeploymentObj = record.create({
								type: 'scriptdeployment',
								defaultValues: {
									script: mrId,
								}
							});
							scriptDeploymentObj.save({
								ignoreMandatoryFields: true
							});

							let taskObj = task.create({
								taskType: taskType,
								scriptId: scriptId,
								params: scriptParams
							});
							taskId = taskObj.submit();
						}
					} else {
						if (recordType && recordId && taskIdFld && taskErrorFld) {
							record.submitFields({
								type: recordType,
								id: recordId,
								values: {
									[taskErrorFld]: `${e.name}: ${e.message}`,
								},
								options: {
									ignoreMandatoryFields: true
								}
							});
						}
					}
				}

				if (taskId) {
					if (recordType && recordId && taskIdFld && taskErrorFld) {
						record.submitFields({
							type: recordType,
							id: recordId,
							values: {
								[taskIdFld]: taskId,
								[taskErrorFld]: '',
							},
							options: {
								ignoreMandatoryFields: true
							}
						});
					}
					response.data = taskId;
					response.success = true;
				}

			} catch (e) {
				response.message = e.message;
			}

			return response;
		}

		return {
			showBackgroundTaskBanner,
			executeScriptTaskAndAutoGenDeployment
		}

	});
