import { app } from "../../scripts/app.js";

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

async function updateModelList(node, modelTypeWidget, folderWidget, subfolderWidget, modelNameWidget, afterGenerateWidget) {
    const models = await fetch(`/model_selector/models?type=${encodeURIComponent(modelTypeWidget.value)}&folder=${encodeURIComponent(folderWidget.value)}&subfolder=${encodeURIComponent(subfolderWidget.value)}`).then(r => r.json());
    const currentValue = modelNameWidget.value;
    let finalModels = [...models];
    let newValue = currentValue;
    if (afterGenerateWidget.value === "increment") {
        finalModels = ["(Start)", ...models];
        if (currentValue !== "(Start)" && !models.includes(currentValue)) {
            newValue = "(Start)";
        }
    } else if (afterGenerateWidget.value === "decrement") {
        finalModels = [...models, "(End)"];
        if (currentValue !== "(End)" && !models.includes(currentValue)) {
            newValue = "(End)";
        }
    } else {
        // fixed or randomize - NO markers
        finalModels = [...models];
        if (currentValue === "(Start)" || currentValue === "(End)") {
            newValue = models[0] || "No models found";
        } else if (!models.includes(currentValue)) {
            newValue = models[0] || "No models found";
        }
    }
    // Update list
    modelNameWidget.options.values = finalModels;
    // Then update value
    modelNameWidget.value = newValue;
    app.graph.setDirtyCanvas(true);
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
                                        modelWidget.value = result.favorites[0] || "No models found";
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
                const afterGenerateWidget = this.widgets.find(w => w.name === "after_generate");

                if (modelTypeWidget && folderWidget && subfolderWidget && modelNameWidget && afterGenerateWidget) {
                    const node = this;

                    const originalTypeCallback = modelTypeWidget.callback;
                    modelTypeWidget.callback = async function() {
                        if (modelTypeWidget.value === "Favorites") {
                            const folders = await fetch(`/model_selector/folders?type=Favorites`).then(r => r.json());
                            folderWidget.options.values = folders;
                            folderWidget.value = "All";
                            subfolderWidget.value = "All";
                            toggleWidget(node, subfolderWidget, false);

                            await updateModelList(node, modelTypeWidget, folderWidget, subfolderWidget, modelNameWidget, afterGenerateWidget);

                            if (originalTypeCallback) return originalTypeCallback.apply(this, arguments);
                            return;
                        }

                        const folders = await fetch(`/model_selector/folders?type=${encodeURIComponent(modelTypeWidget.value)}`).then(r => r.json());
                        folderWidget.options.values = folders;
                        folderWidget.value = "All";
                        toggleWidget(node, subfolderWidget, false);

                        await updateModelList(node, modelTypeWidget, folderWidget, subfolderWidget, modelNameWidget, afterGenerateWidget);

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

                        await updateModelList(node, modelTypeWidget, folderWidget, subfolderWidget, modelNameWidget, afterGenerateWidget);

                        if (originalFolderCallback) return originalFolderCallback.apply(this, arguments);
                    };

                    const originalSubfolderCallback = subfolderWidget.callback;
                    subfolderWidget.callback = async function() {
                        await updateModelList(node, modelTypeWidget, folderWidget, subfolderWidget, modelNameWidget, afterGenerateWidget);

                        if (originalSubfolderCallback) return originalSubfolderCallback.apply(this, arguments);
                    };

                    const originalAfterGenerateCallback = afterGenerateWidget.callback;
                    afterGenerateWidget.callback = async function() {
                        await updateModelList(node, modelTypeWidget, folderWidget, subfolderWidget, modelNameWidget, afterGenerateWidget);

                        if (originalAfterGenerateCallback) return originalAfterGenerateCallback.apply(this, arguments);
                    };
                }

                if (modelNameWidget && afterGenerateWidget) {
                    const originalCallback = modelNameWidget.callback;
                    modelNameWidget.callback = async function() {
                        const selectedValue = modelNameWidget.value;

                        if (selectedValue !== "(Start)" && selectedValue !== "(End)") {
                            afterGenerateWidget.value = "fixed";
                            const models = await fetch(`/model_selector/models?type=${encodeURIComponent(modelTypeWidget.value)}&folder=${encodeURIComponent(folderWidget.value)}&subfolder=${encodeURIComponent(subfolderWidget.value)}`).then(r => r.json());
                            modelNameWidget.options.values = [...models];
                            modelNameWidget.value = selectedValue;
                            
                            app.graph.setDirtyCanvas(true);
                        }

                        if (originalCallback) return originalCallback.apply(this, arguments);
                    };
                }

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
                const afterGenerateWidget = this.widgets.find(w => w.name === "after_generate");

                if (modelTypeWidget && folderWidget && subfolderWidget && modelNameWidget && afterGenerateWidget) {
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

                    await updateModelList(node, modelTypeWidget, folderWidget, subfolderWidget, modelNameWidget, afterGenerateWidget);
                    modelNameWidget.value = savedModel;
                }
            };
        }
    }
});