sap.ui.define(["sap/ui/test/Opa5"], function (Opa5) {
    "use strict";

    return Opa5.extend("demo.bookingapp.test.integration.arrangements.Startup", {
        iStartMyApp: function () {
            this.iStartMyUIComponent({
                componentConfig: {
                    name: "demo.bookingapp",
                    async: true,
                    manifest: true
                }
            });
        }
    });
});
