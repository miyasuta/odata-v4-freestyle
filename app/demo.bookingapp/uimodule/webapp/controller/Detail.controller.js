sap.ui.define([
    "demo/bookingapp/controller/BaseController",	
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel"
], function (Controller, Filter, FilterOperator, MessageToast, MessageBox, JSONModel) {
    "use strict";

    return Controller.extend("demo.bookingapp.controller.Detail", {
        onInit: function () {
            this._mode = undefined; //1: create 2: edit 3: display
            this.getRouter().getRoute("Detail").attachMatched(this._onRouteMatched, this);

            var oModel = new JSONModel({
                savingStatus: "",
                isStatusVisible: false,
                deleteEnabled: false,
                editable: false,
                busy: false
            });
            this.setModel(oModel, "viewModel");
        },

        onEdit: function () {
            //create draft
            this.setProperty("viewModel", "busy", true);
            this._createDraft()
            .then(oCreateContext => {
                this._attachPatchEvents();
                //set to edit mode
                this._mode = 2;
                this._setEditable(true);   
                this.setProperty("viewModel", "busy", false);             
            })
            .catch(error => {
                MessageBox.error(error.message, {});
                this.setProperty("viewModel", "busy", false);
            });         
        },

        onDelete: function () {
            this.onCancel();
        },

        onAddItem: function () {
            var oListBinding = this.byId("itemTable").getBinding("items");
            oListBinding.create({});
        },

        onDeleteItem: function (oEvent) {
            oEvent.getParameter("listItem").getBindingContext().delete("$auto")
            .then(()=> {             
                this._requestTotalAmount();
            })
            .catch(error => {
                /*workaround
                If you add a new item and delete an existing item before saving,
                the following error can occur.
                */
                if(error.message === "Cannot read property '@$ui5._' of undefined") {
                    MessageBox.information("The item could not be deleted. Please save first and retry  ", );
                } else {
                    MessageBox.error(error.message, {});
                }                
            })
        },

        onSave: function () {
            var hasError = this._doCheck();
            if (hasError) {
                return;
            }

            var oContext = this.getView().getBindingContext();
            var oModel = this.getModel();
            var oOperation = oModel.bindContext("OrderingService.draftActivate(...)", oContext);
            oOperation.execute()
            .then(() => {
                MessageToast.show("Data has been saved", {
                    closeOnBrowserNavigation: false
                });
                var oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("List");
            })                      
            .catch(error => {               
                MessageBox.error(error.message, {});
            });
        },

        onChange: function (oEvent) {
            this._clearErrorState(oEvent.getSource().getId());
        },

        onCancel: function () {
            const { confirmMessage, buttonText } = this._getDeleteMessage();
            MessageBox.confirm(confirmMessage, {
				actions: [buttonText, MessageBox.Action.CLOSE],
				emphasizedAction: buttonText,                
                onClose: this._discardDraft.bind(this)
            });
        },     

        onValidate: function (oEvent) {
            var filedGroupId = oEvent.getSource().getFieldGroupIds()[0];
            if (filedGroupId === "amount") {
                this._requestTotalAmount();
            }            
        },

        _requestTotalAmount: function () {
            this.getView().getObjectBinding().getBoundContext().requestSideEffects([{
                $PropertyPath: "totalAmount"
            }], "$auto");
        },

        _doCheck: function () {
            //Check mandatory fields
            var hasError = false;
            var aMandatoryFiledLabels = this.getView().getControlsByFieldGroupId("mandatory");
            aMandatoryFiledLabels.forEach(oLabel => {
                let mandatoryFiledId = oLabel.getLabelFor();
                if (this._isBlank(mandatoryFiledId)) {
                    this._setErrorState(mandatoryFiledId);
                    hasError = true;
                }
            });
            return hasError;
        },

        _isBlank: function (id) {
            var value = this.byId(id).getValue();
            return value === "" ? true : false
        },

        _setErrorState: function (id) {
            var oControl = this.byId(id);
            oControl.setValueState("Error");
            oControl.setValueStateText("Filed is mandatory");
        },

        _clearErrorState: function (id) {
            var oControl = this.byId(id);
            oControl.setValueState("None");
            oControl.setValueStateText("");
        },

        _onRouteMatched: function (oEvent) {
            var oArgs = oEvent.getParameter("arguments");
            var id = oArgs.id;
            //create
            if (id === undefined) {
                this._handleCreate();
            //edit or display
            } else {
                this._handleEditDisplay(id);
            }                 
        },        

        _discardDraft: function (oAction) {
            if (oAction === MessageBox.Action.CLOSE) { 
                return
            }

            var oContext = this.getView().getBindingContext();
            oContext.delete("$auto")
            .then(()=> {
                var deleteMessage = this._getDeleteMessage().deleteMessage;
                MessageToast.show(deleteMessage, {
                    closeOnBrowserNavigation: false
                });
                var oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("List");                
            });
        },

        _handleCreate: function () {
            var oListBinding = this.getModel().bindList("/Orders");
            var oContext = oListBinding.create();
            oContext.created()
            .then(() => {
                this.getView().bindObject(oContext.getPath());
                this._attachPatchEvents();
                this._mode = 1;                
                this._setEditable(true);
            })
            .catch(error => {
                MessageBox.error(error.message, {});
            });
        },

        _handleEditDisplay: function (id) {
            var oModel = this.getModel();
            var oContextBinding = oModel.bindContext(`/Orders(ID=${id},IsActiveEntity=true)`);
            var oContext = oContextBinding.getBoundContext();
            oContext.requestProperty("HasDraftEntity")
            .then(hasDraft => {
                //bind context to the view
                this._bindContext(hasDraft, id, oContext);
                this._attachPatchEvents();
                this._getOrderId();

                if (hasDraft) {
                    //open in edit mode
                    this._mode = 2;
                    this._setEditable(true);
                } else {
                    //open in display mode
                    this._mode = 3;
                    this._setEditable(false);
                }
            })
            .catch(error => {
                console.log(error);
            });              
        },

        _getOrderId: function () {
            this.getView().getBindingContext().requestProperty("orderId")
            .then(orderId => {
                this._orderId = orderId;
            })
            .catch(error => {
                console.log(error);
            });
        },

        _setEditable(bEditable) {
            this.setProperty("viewModel", "editable", bEditable);
        },

        _attachPatchEvents: function () {
            this.getView().getObjectBinding().attachPatchSent(this._patchSent, this);
            this.getView().getObjectBinding().attachPatchCompleted(this._patchCompleted, this);
        },

        _patchSent: function (oEvent) {
            this.setProperty("viewModel", "savingStatus", "Saving draft …");
            this.setProperty("viewModel", "isStatusVisible", true);
        },

        _patchCompleted: function () {
            this.setProperty("viewModel", "savingStatus", "Draft saved");
            this.setProperty("viewModel", "isStatusVisible", true);

            //clear draft saving message after 1.5 seconds
            setTimeout(()=> {
                this.setProperty("viewModel", "savingStatus", "");
                this.setProperty("viewModel", "isStatusVisible", false);                
            }, 1500)
        },

        _bindContext: function (hasDraft, id, oContext) {
            //if draft exists, bind the draft version
            //else bind the active version
            var isActive = !hasDraft;
            this.getView().bindObject(`/Orders(ID=${id},IsActiveEntity=${isActive})`);
        },

        _createDraft: function () {
            return new Promise((resolve, reject) => {
                var oContext = this.getView().getObjectBinding().getBoundContext();
                var oModel = this.getModel();
                var oOperation = oModel.bindContext("OrderingService.draftEdit(...)", oContext);
                oOperation.execute()
                .then(oUpdatedContext => {
                    this.getView().bindObject(oUpdatedContext.getPath());
                    resolve();
                })                      
                .catch(error => {
                    reject(error);
                }); 
            });
        },

        _getDeleteMessage: function (aContexts) {
            var oMessage = {
                confirmMessage: "",
                deleteMessage: "",
                buttonText: ""
            };
            switch (this._mode) {
                case 1: //create
                    oMessage.confirmMessage = `Discard this draft?`;
                    oMessage.deleteMessage = `Draft discarded`; 
                    oMessage.buttonText = `Discard`               
                    break;
                case 2: //edit
                    oMessage.confirmMessage = `Discard all changes?`;
                    oMessage.deleteMessage = `Changes discarded`;     
                    oMessage.buttonText = `Discard`           
                    break;

                case 3: //dispaly
                    oMessage.confirmMessage = `Delete order ${this._orderId}?`;
                    oMessage.deleteMessage = `Order ${this._orderId} has been deleted`;
                    oMessage.buttonText = `Delete`              
                    break;
            }
            return oMessage;
        }   
    });
});
