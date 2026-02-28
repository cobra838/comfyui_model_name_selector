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
            
            // Add right-click menu options for favorites
            const getExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
            nodeType.prototype.getExtraMenuOptions = function(_, options) {
                if (getExtraMenuOptions) getExtraMenuOptions.apply(this, arguments);
                
                const modelWidget = this.widgets.find(w => w.name === "model_name");
                if (!modelWidget || modelWidget.value === "No models found") return;
                
                options.unshift(
                    {
                        content: "⭐ Add to Favorites",
                        callback: async () => {
                            try {
                                const response = await fetch("/model_selector/favorites/add", {
                                    method: "POST",
                                    headers: {"Content-Type": "application/json"},
                                    body: JSON.stringify({model: modelWidget.value})
                                });
                                const result = await response.json();
                                if (result.success) {
                                    console.log("Added to favorites:", modelWidget.value);
                                }
                            } catch (err) {
                                console.error("Failed to add favorite:", err);
                            }
                        }
                    },
                    {
                        content: "❌ Remove from Favorites",
                        callback: async () => {
                            try {
                                const response = await fetch("/model_selector/favorites/remove", {
                                    method: "POST",
                                    headers: {"Content-Type": "application/json"},
                                    body: JSON.stringify({model: modelWidget.value})
                                });
                                const result = await response.json();
                                if (result.success) {
                                    const modelTypeWidget = this.widgets.find(w => w.name === "model_type");
                                    if (modelTypeWidget && modelTypeWidget.value === "Favorites") {
                                        modelWidget.options.values = result.favorites.length > 0 ? result.favorites : ["No models found"];
                                        
                                        const oldModel = modelWidget.value;
                                        modelWidget.value = result.favorites[0] || "No models found";
                                        if (oldModel !== modelWidget.value) {
                                            const controlWidget = this.widgets.find(w => w.name === "after_generate");
                                            if (controlWidget) controlWidget.value = "fixed";
                                        }
                                        
                                        app.graph.setDirtyCanvas(true);
                                    }
                                }
                            } catch (err) {
                                console.error("Failed to remove favorite:", err);
                            }
                        }
                    }
                );
            };
            
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = async function() {
                if (onNodeCreated) onNodeCreated.apply(this, arguments);
                
                const modelTypeWidget = this.widgets.find(w => w.name === "model_type");
                const folderWidget = this.widgets.find(w => w.name === "folder");
                const subfolderWidget = this.widgets.find(w => w.name === "subfolder");
                const modelNameWidget = this.widgets.find(w => w.name === "model_name");
                const controlWidget = this.widgets.find(w => w.name === "after_generate");
                
                if (modelTypeWidget && folderWidget && subfolderWidget && modelNameWidget) {
                    const node = this;
                    
                    const originalTypeCallback = modelTypeWidget.callback;
                    modelTypeWidget.callback = async function() {
                        if (modelTypeWidget.value === "Favorites") {
                            const folders = await fetch(`/model_selector/folders?type=Favorites`).then(r => r.json());
                            folderWidget.options.values = folders;
                            const favorites = await fetch("/model_selector/favorites").then(r => r.json());
                            folderWidget.value = "All";
                            subfolderWidget.value = "All";
                            toggleWidget(node, subfolderWidget, false);
                            modelNameWidget.options.values = favorites.length > 0 ? favorites : ["No models found"];
                            
                            const oldModel = modelNameWidget.value;
                            modelNameWidget.value = favorites[0] || "No models found";
                            if (oldModel !== modelNameWidget.value) {
                                controlWidget.value = "fixed";
                            }
                            
                            app.graph.setDirtyCanvas(true);
                            if (originalTypeCallback) return originalTypeCallback.apply(this, arguments);
                            return;
                        }
                        
                        const folders = await fetch(`/model_selector/folders?type=${encodeURIComponent(modelTypeWidget.value)}`).then(r => r.json());
                        folderWidget.options.values = folders;
                        folderWidget.value = "All";
                        
                        toggleWidget(node, subfolderWidget, false);
                        
                        const models = await fetch(`/model_selector/models?type=${encodeURIComponent(modelTypeWidget.value)}&folder=All&subfolder=All`).then(r => r.json());
                        modelNameWidget.options.values = models;
                        
                        const oldModel = modelNameWidget.value;
                        modelNameWidget.value = models[0] || "No models found";
                        if (oldModel !== modelNameWidget.value) {
                            controlWidget.value = "fixed";
                        }
                        
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
                        
                        const oldModel = modelNameWidget.value;
                        modelNameWidget.value = models[0] || "No models found";
                        if (oldModel !== modelNameWidget.value) {
                            controlWidget.value = "fixed";
                        }
                        
                        app.graph.setDirtyCanvas(true);
                        if (originalFolderCallback) return originalFolderCallback.apply(this, arguments);
                    };
                    
                    const originalSubfolderCallback = subfolderWidget.callback;
                    subfolderWidget.callback = async function() {
                        const models = await fetch(`/model_selector/models?type=${encodeURIComponent(modelTypeWidget.value)}&folder=${encodeURIComponent(folderWidget.value)}&subfolder=${encodeURIComponent(subfolderWidget.value)}`).then(r => r.json());
                        modelNameWidget.options.values = models;
                        
                        const oldModel = modelNameWidget.value;
                        modelNameWidget.value = models[0] || "No models found";
                        if (oldModel !== modelNameWidget.value) {
                            controlWidget.value = "fixed";
                        }
                        
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