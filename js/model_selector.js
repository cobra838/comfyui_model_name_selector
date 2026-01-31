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
                const folderWidget = this.widgets.find(w => w.name === "folder");
                const modelNameWidget = this.widgets.find(w => w.name === "model_name");
                const controlWidget = this.widgets.find(w => w.name === "control_after_generate");
                
                if (modelTypeWidget && folderWidget && modelNameWidget) {
                    const originalTypeCallback = modelTypeWidget.callback;
                    modelTypeWidget.callback = async function() {
                        const folders = await fetch(`/model_selector/folders?type=${encodeURIComponent(modelTypeWidget.value)}`).then(r => r.json());
                        folderWidget.options.values = folders;
                        folderWidget.value = "All";
                        
                        const models = await fetch(`/model_selector/models?type=${encodeURIComponent(modelTypeWidget.value)}&folder=All`).then(r => r.json());
                        modelNameWidget.options.values = models;
                        modelNameWidget.value = models[0] || "No models found";
                        
                        app.graph.setDirtyCanvas(true);
                        if (originalTypeCallback) return originalTypeCallback.apply(this, arguments);
                    };
                    
                    const originalFolderCallback = folderWidget.callback;
                    folderWidget.callback = async function() {
                        const models = await fetch(`/model_selector/models?type=${encodeURIComponent(modelTypeWidget.value)}&folder=${encodeURIComponent(folderWidget.value)}`).then(r => r.json());
                        modelNameWidget.options.values = models;
                        modelNameWidget.value = models[0] || "No models found";
                        
                        app.graph.setDirtyCanvas(true);
                        if (originalFolderCallback) return originalFolderCallback.apply(this, arguments);
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
            
            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = async function() {
                if (onConfigure) onConfigure.apply(this, arguments);
                
                const modelTypeWidget = this.widgets.find(w => w.name === "model_type");
                const folderWidget = this.widgets.find(w => w.name === "folder");
                const modelNameWidget = this.widgets.find(w => w.name === "model_name");
                
                if (modelTypeWidget && folderWidget && modelNameWidget) {
                    const savedFolder = folderWidget.value;
                    const savedModel = modelNameWidget.value;
                    
                    const folders = await fetch(`/model_selector/folders?type=${encodeURIComponent(modelTypeWidget.value)}`).then(r => r.json());
                    folderWidget.options.values = folders;
                    folderWidget.value = savedFolder;
                    
                    const models = await fetch(`/model_selector/models?type=${encodeURIComponent(modelTypeWidget.value)}&folder=${encodeURIComponent(folderWidget.value)}`).then(r => r.json());
                    modelNameWidget.options.values = models;
                    modelNameWidget.value = savedModel;
                }
            };
        }
    }
});