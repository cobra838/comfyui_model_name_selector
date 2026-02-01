import { app } from "../../scripts/app.js";

// toggleWidget function adapted from yolain/ComfyUI-Easy-Use
const origProps = {};

function toggleWidget(node, widget, show = false) {
    if (!widget) return;
    
    if (!origProps[widget.name]) {
        origProps[widget.name] = { origType: widget.type, origComputeSize: widget.computeSize };
    }
    
    const origSize = node.size;
    widget.type = show ? origProps[widget.name].origType : "hidden";
    widget.computeSize = show ? origProps[widget.name].origComputeSize : () => [0, -4];
    
    const height = show ? Math.max(node.computeSize()[1], origSize[1]) : node.size[1];
    node.setSize([node.size[0], height]);
}

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
                const subfolderWidget = this.widgets.find(w => w.name === "subfolder");
                const modelNameWidget = this.widgets.find(w => w.name === "model_name");
                const controlWidget = this.widgets.find(w => w.name === "control_after_generate");
                
                if (modelTypeWidget && folderWidget && subfolderWidget && modelNameWidget) {
                    const node = this;
                    
                    const originalTypeCallback = modelTypeWidget.callback;
                    modelTypeWidget.callback = async function() {
                        const folders = await fetch(`/model_selector/folders?type=${encodeURIComponent(modelTypeWidget.value)}`).then(r => r.json());
                        folderWidget.options.values = folders;
                        folderWidget.value = "All";
                        
                        toggleWidget(node, subfolderWidget, false);
                        
                        const models = await fetch(`/model_selector/models?type=${encodeURIComponent(modelTypeWidget.value)}&folder=All&subfolder=All`).then(r => r.json());
                        modelNameWidget.options.values = models;
                        modelNameWidget.value = models[0] || "No models found";
                        
                        app.graph.setDirtyCanvas(true);
                        if (originalTypeCallback) return originalTypeCallback.apply(this, arguments);
                    };
                    
                    const originalFolderCallback = folderWidget.callback;
                    folderWidget.callback = async function() {
                        const subfolders = await fetch(`/model_selector/subfolders?type=${encodeURIComponent(modelTypeWidget.value)}&folder=${encodeURIComponent(folderWidget.value)}`).then(r => r.json());
                        
                        if (folderWidget.value === "All" || subfolders.length === 1) {
                            toggleWidget(node, subfolderWidget, false);
                            subfolderWidget.value = "All";
                        } else {
                            subfolderWidget.options.values = subfolders;
                            subfolderWidget.value = "All";
                            toggleWidget(node, subfolderWidget, true);
                        }
                        
                        const models = await fetch(`/model_selector/models?type=${encodeURIComponent(modelTypeWidget.value)}&folder=${encodeURIComponent(folderWidget.value)}&subfolder=All`).then(r => r.json());
                        modelNameWidget.options.values = models;
                        modelNameWidget.value = models[0] || "No models found";
                        
                        app.graph.setDirtyCanvas(true);
                        if (originalFolderCallback) return originalFolderCallback.apply(this, arguments);
                    };
                    
                    const originalSubfolderCallback = subfolderWidget.callback;
                    subfolderWidget.callback = async function() {
                        const models = await fetch(`/model_selector/models?type=${encodeURIComponent(modelTypeWidget.value)}&folder=${encodeURIComponent(folderWidget.value)}&subfolder=${encodeURIComponent(subfolderWidget.value)}`).then(r => r.json());
                        modelNameWidget.options.values = models;
                        modelNameWidget.value = models[0] || "No models found";
                        
                        app.graph.setDirtyCanvas(true);
                        if (originalSubfolderCallback) return originalSubfolderCallback.apply(this, arguments);
                    };
                }
                
                if (modelNameWidget && controlWidget) {
                    const originalCallback = modelNameWidget.callback;
                    modelNameWidget.callback = function() {
                        controlWidget.value = "fixed";
                        if (originalCallback) return originalCallback.apply(this, arguments);
                    };
                }
                
                // Hide subfolder initially if needed
                if (folderWidget && subfolderWidget) {
                    if (folderWidget.value === "All") {
                        toggleWidget(node, subfolderWidget, false);
                    }
                }
            };
            
            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = async function() {
                if (onConfigure) onConfigure.apply(this, arguments);
                
                const node = this;
                const modelTypeWidget = this.widgets.find(w => w.name === "model_type");
                const folderWidget = this.widgets.find(w => w.name === "folder");
                const subfolderWidget = this.widgets.find(w => w.name === "subfolder");
                const modelNameWidget = this.widgets.find(w => w.name === "model_name");
                
                if (modelTypeWidget && folderWidget && subfolderWidget && modelNameWidget) {
                    const savedFolder = folderWidget.value;
                    const savedSubfolder = subfolderWidget.value;
                    const savedModel = modelNameWidget.value;
                    
                    const folders = await fetch(`/model_selector/folders?type=${encodeURIComponent(modelTypeWidget.value)}`).then(r => r.json());
                    folderWidget.options.values = folders;
                    folderWidget.value = savedFolder;
                    
                    const subfolders = await fetch(`/model_selector/subfolders?type=${encodeURIComponent(modelTypeWidget.value)}&folder=${encodeURIComponent(folderWidget.value)}`).then(r => r.json());
                    
                    if (folderWidget.value === "All" || subfolders.length === 1) {
                        toggleWidget(node, subfolderWidget, false);
                    } else {
                        subfolderWidget.options.values = subfolders;
                        subfolderWidget.value = savedSubfolder;
                        toggleWidget(node, subfolderWidget, true);
                    }
                    
                    const models = await fetch(`/model_selector/models?type=${encodeURIComponent(modelTypeWidget.value)}&folder=${encodeURIComponent(folderWidget.value)}&subfolder=${encodeURIComponent(subfolderWidget.value)}`).then(r => r.json());
                    modelNameWidget.options.values = models;
                    modelNameWidget.value = savedModel;
                }
            };
        }
    }
});