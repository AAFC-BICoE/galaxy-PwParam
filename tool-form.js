/**
    This is the regular tool form.
*/
//{!REQUIRESCRIPT("/soap/ajax/29.0/connection.js")}
//{!REQUIRESCRIPT("/soap/ajax/29.0/apex.js")}


define(['utils/utils', 'mvc/ui/ui-misc', 'mvc/tool/tool-form-base', 'mvc/tool/tool-template'],
    function( Utils, Ui, ToolFormBase, ToolTemplate ) {
    var View = ToolFormBase.extend({
        initialize: function( options ) {
            var self = this;
            ToolFormBase.prototype.initialize.call( this, Utils.merge({
                customize       : function( options ) {
                    // build execute button
                    options.buttons = {
                        execute : execute_btn = new Ui.Button({
                            icon     : 'fa-check',
                            tooltip  : 'Execute: ' + options.name + ' (' + options.version + ')',
                            title    : 'Execute',
                            cls      : 'ui-button btn btn-primary',
                            floating : 'clear',
                            onclick  : function() {
                                execute_btn.wait();
                                self.portlet.disable();
                                self.submit( options, function() {
                                    execute_btn.unwait();
                                    self.portlet.enable();
                                } );
                            }
                        })
                    };
                    // remap feature
                    if ( options.job_id && options.job_remap ) {
                        options.inputs[ 'rerun_remap_job_id' ] = {
                            label       : 'Resume dependencies from this job',
                            name        : 'rerun_remap_job_id',
                            type        : 'select',
                            display     : 'radio',
                            ignore      : '__ignore__',
                            value       : '__ignore__',
                            options     : [ [ 'Yes', options.job_id ], [ 'No', '__ignore__' ] ],
                            help        : 'The previous run of this tool failed and other tools were waiting for it to finish successfully. Use this option to resume those tools using the new output(s) of this tool run.'
                        }
                    }
                }
            }, options ) );
        },

        /** Submit a regular job.
         * @param{dict}     options   - Specifies tool id and version
         * @param{function} callback  - Called when request has completed
         */
        submit: function( options, callback ) {
            var self = this;
            var job_def = {
                tool_id         : options.id,
                tool_version    : options.version,
                inputs          : this.data.create()
            }
	    //console.log(Object.keys(job_def));
	    for (var job_input_id in job_def.inputs){
	//	console.log("This should be the value: " + job_def.inputs[job_input_id]);
		var input_id = this.data.match(job_input_id);
	//	console.log("This is the input id: " + this.data.match( job_input_id));
		var input_def = this.input_list[ input_id ];
		var typeParam = input_def['type']
	//	console.log("this is the input type: " + typeParam);
		if (typeParam == "password"){
			//console.log("I got to confirming the type of the parameter");
			//self.encode(job_def.inputs[job_input_id]);
			job_def.inputs[job_input_id] = "newpass";
		}
	    }		
            this.trigger( 'reset' );
            if ( !self.validate( job_def ) ) {
                Galaxy.emit.debug( 'tool-form::submit()', 'Submission canceled. Validation failed.' );
                callback && callback();
                return;
            }
            if ( options.action !== Galaxy.root + 'tool_runner/index' ) {
                var $f = $( '<form/>' ).attr( { action: options.action, method: options.method, enctype: options.enctype } );
                _.each( job_def.inputs, function( value, key ) { $f.append( $( '<input/>' ).attr( { 'name': key, 'value': value } ) ) } );
                $f.hide().appendTo( 'body' ).submit().remove();
                callback && callback();
                return;
            }
            Galaxy.emit.debug( 'tool-form::submit()', 'Validation complete.', job_def );
            Utils.request({
                type    : 'POST',
                url     : Galaxy.root + 'api/tools',
                data    : job_def,
                success : function( response ) {
                    callback && callback();
                    self.$el.empty().append( ToolTemplate.success( response ) );
                    parent.Galaxy && parent.Galaxy.currHistoryPanel && parent.Galaxy.currHistoryPanel.refreshContents();
                },
                error   : function( response ) {
                    callback && callback();
                    Galaxy.emit.debug( 'tool-form::submit', 'Submission failed.', response );
                    if ( response && response.err_data ) {
                        var error_messages = self.data.matchResponse( response.err_data );
                        for (var input_id in error_messages) {
                            self.highlight( input_id, error_messages[ input_id ]);
                            break;
                        }
                    } else {
                        self.modal.show({
                            title   : 'Job submission failed',
                            body    : ( response && response.err_msg ) || ToolTemplate.error( job_def ),
                            buttons : {
                                'Close' : function() {
                                    self.modal.hide();
                                }
                            }
                        });
                    }
                }
            });
        }, //this is where the submit function ends
	
	//encode: function( pwString ) {
	//	console.log(Date.now());
	//	sforce.connection.sessionId = "{!$Api.Session_ID}";
	 //       console.log("Here is the user id: " + sforce.connection.getUserInfo().userId);

//	},	
		

        /** Validate job dictionary.
         * @param{dict}     job_def   - Job execution dictionary
        */
        validate: function( job_def ) {
            var job_inputs  = job_def.inputs;
            var batch_n     = -1;
            var batch_src   = null;
            for ( var job_input_id in job_inputs ) {
                var input_value = job_inputs[ job_input_id ];
		//console.log("Value is: " + input_value);
                var input_id    = this.data.match( job_input_id );
		//console.log("Input_id: " + input_id);
                var input_field = this.field_list[ input_id ];
		//console.log("Input_field: " + input_field)
		//console.log(Object.keys(input_field));
		var input_def   = this.input_list[ input_id ];
		//console.log("Input_def: " + input_def);
                //console.log(Object.keys(input_def));
		//console.log("Type is: " + input_def['type'])
//		if (input_def['type'] == 'password' ){
//			this.input_list[input_id]['value'] = "newpass";
		
		if ( !input_id || !input_def || !input_field ) {
                    Galaxy.emit.debug('tool-form::validate()', 'Retrieving input objects failed.');
                    continue;
                }
                if ( !input_def.optional && input_value == null ) {
                    this.highlight( input_id );
                    return false;
                }
                if ( input_value && input_value.batch ) {
                    var n = input_value.values.length;
                    var src = n > 0 && input_value.values[ 0 ] && input_value.values[ 0 ].src;
                    if ( src ) {
                        if ( batch_src === null ) {
                            batch_src = src;
                        } else if ( batch_src !== src ) {
                            this.highlight( input_id, 'Please select either dataset or dataset list fields for all batch mode fields.' );
                            return false;
                        }
                    }
                    if ( batch_n === -1 ) {
                        batch_n = n;
                    } else if ( batch_n !== n ) {
                        this.highlight( input_id, 'Please make sure that you select the same number of inputs for all batch mode fields. This field contains <b>' + n + '</b> selection(s) while a previous field contains <b>' + batch_n + '</b>.' );
                        return false;
                    }
                }
            }
            return true;
        }//this is where the validate function ends.
    });

    return {
        View: View
    };
});

