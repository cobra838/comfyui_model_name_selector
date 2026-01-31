import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "ModelNameSelector",
    
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === "ModelNameSelector") {
            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function(message) {
                if (onExecuted) onExecuted.apply(this, arguments);
                
                if (message?.model_name) {
                    const widget = this.widgets.find(w => w.name === "model_name");
                    if (widget) {
                        widget.value = message.model_name[0];
                        app.graph.setDirtyCanvas(true);
                    }
                }
            };
            
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = async function() {
                if (onNodeCreated) onNodeCreated.apply(this, arguments);
                
                const modelTypeWidget = this.widgets.find(w => w.name === "model_type");
                const modelNameWidget = this.widgets.find(w => w.name === "model_name");
                const controlWidget = this.widgets.find(w => w.name === "control_after_generate");
                
                if (modelTypeWidget && modelNameWidget) {
                    const originalCallback = modelTypeWidget.callback;
                    modelTypeWidget.callback = async function() {
                        const models = await fetch(`/model_selector/models?type=${encodeURIComponent(modelTypeWidget.value)}`).then(r => r.json());
                        modelNameWidget.options.values = models;
                        modelNameWidget.value = models[0] || "No models found";
                        app.graph.setDirtyCanvas(true);
                        if (originalCallback) return originalCallback.apply(this, arguments);
                    };
                }
                
                if (modelNameWidget && controlWidget) {
                    const originalCallback = modelNameWidget.callback;
                    modelNameWidget.callback = function() {
                        controlWidget.value = "fixed";
                        if (originalCallback) return originalCallback.apply(this, arguments);
                    };
                }
            };
        }
    }
});