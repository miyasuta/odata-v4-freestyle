sap.ui.define([
    "demo/bookingapp/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, JSONModel, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend("demo.bookingapp.controller.List", {
        onInit: function () {
            this.getRouter().getRoute("List").attachMatched(this._onRouteMatched, this);
            var oModel = new JSONModel({
                deleteEnabled: false,
                busy: false
            });
            this.setModel(oModel, "viewModel");
        },

        onAdd: function () {
            this.getRouter().navTo("Detail", {});
        },

        onDelete: function () {
            var oTable = this.byId("table");
            var aContexts = oTable.getSelectedContexts();
            this._orderId = aContexts[0].getProperty("orderId");
            var confirmMessage = this._getDeleteMessage(aContexts).confirmMessage

            MessageBox.confirm(confirmMessage, {
				actions: ["Delete", MessageBox.Action.CLOSE],
				emphasizedAction: "Delete",                
                onClose: this._deleteOrders.bind(this)
            });
        },

        onDetailPress: function (oEvent) {
            var id = oEvent.getSource().getBindingContext().getProperty("ID");
            this.getRouter().navTo("Detail", {
                id: id
            });
        },

        onSelectionChange: function (oEvent) {
            var aContexts = oEvent.getSource().getSelectedContexts();
            if (aContexts.length > 0) {
                this.setProperty("viewModel", "deleteEnabled", true);
            } else {
                this.setProperty("viewModel", "deleteEnabled", false);
            }
        },

        editingStatus: function (sHasDraftEntity) {
            var status = "";
            if (sHasDraftEntity === "Yes") {
                status = "Draft";
            } else {
                status = "Active";
            }
            return status;
        },

        _onRouteMatched: function () {
            this._doRefresh();
        },

        _doRefresh: function () {
            var oTable = this.byId("table");
            oTable.getBinding("items").refresh();
        },

        _deleteOrders: function (oAction) {
            if (oAction === MessageBox.Action.CLOSE) { 
                return
            }

            var oTable = this.byId("table");
            var aContexts = oTable.getSelectedContexts();
            this.setProperty("viewModel", "busy", true);
            var aDeletePromises = aContexts.map(oContext => {
                return oContext.delete("$auto")
            });

            Promise.all(aDeletePromises)
            .then(() => {
                var deleteMessage = this._getDeleteMessage(aContexts).deleteMessage
                MessageToast.show(deleteMessage, {
                    closeOnBrowserNavigation: false
                });
                this._doRefresh();       
                this.setProperty("viewModel", "busy", false);     
            })
            .catch(error => {
                console.log(error);
                this.setProperty("viewModel", "busy", false);
            });
            
        },

        _getDeleteMessage: function (aContexts) {
            var oMessage = {};
            if (aContexts.length > 1) {
                oMessage.confirmMessage = `Delete selected orders?`;
                oMessage.deleteMessage = `Orders has been deleted`;
            } else {                
                oMessage.confirmMessage = `Delete order ${this._orderId}?`;
                oMessage.deleteMessage = `Order ${this._orderId} has been deleted`;
            }
            return oMessage;
        }

    });
});
