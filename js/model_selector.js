import { app } from "../../scripts/app.js";

// Storage for original widget properties (adapted from yolain/ComfyUI-Easy-Use)
const origProps = {};

// Manages widget visibility by hiding/showing widgets
class WidgetVisibility {
    static toggle(node, widget, show = false) {
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
}

// Handles API requests to backend
class API {
    static async getFolders(modelType) {
        const response = await fetch(`/model_selector/folders?type=${encodeURIComponent(modelType)}`);
        return response.json();
    }
    
    static async getSubfolders(modelType, folder) {
        const response = await fetch(`/model_selector/subfolders?type=${encodeURIComponent(modelType)}&folder=${encodeURIComponent(folder)}`);
        return response.json();
    }
    
    static async getModels(modelType, folder, subfolder) {
        const response = await fetch(`/model_selector/models?type=${encodeURIComponent(modelType)}&folder=${encodeURIComponent(folder)}&subfolder=${encodeURIComponent(subfolder)}`);
        return response.json();
    }
}

// Handles model_type widget changes
class ModelTypeHandler {
    constructor(node, widgets) {
        this.node = node;
        this.widgets = widgets;
    }
    
    setup() {
        const original = this.widgets.modelType.callback;
        this.widgets.modelType.callback = async () => {
            const folders = await API.getFolders(this.widgets.modelType.value);
            this.widgets.folder.options.values = folders;
            this.widgets.folder.value = "All";
            
            WidgetVisibility.toggle(this.node, this.widgets.subfolder, false);
            
            const models = await API.getModels(this.widgets.modelType.value, "All", "All");
            this.widgets.modelName.options.values = models;
            this.widgets.modelName.value = models[0] || "No models found";
            
            app.graph.setDirtyCanvas(true);
            if (original) return original.apply(this.widgets.modelType, arguments);
        };
    }
}

// Handles folder widget changes
class FolderHandler {
    constructor(node, widgets) {
        this.node = node;
        this.widgets = widgets;
    }
    
    setup() {
        const original = this.widgets.folder.callback;
        this.widgets.folder.callback = async () => {
            const subfolders = await API.getSubfolders(this.widgets.modelType.value, this.widgets.folder.value);
            
            if (this.widgets.folder.value === "All" || subfolders.length === 1) {
                WidgetVisibility.toggle(this.node, this.widgets.subfolder, false);
                this.widgets.subfolder.value = "All";
            } else {
                this.widgets.subfolder.options.values = subfolders;
                this.widgets.subfolder.value = "All";
                WidgetVisibility.toggle(this.node, this.widgets.subfolder, true);
            }
            
            const models = await API.getModels(this.widgets.modelType.value, this.widgets.folder.value, "All");
            this.widgets.modelName.options.values = models;
            this.widgets.modelName.value = models[0] || "No models found";
            
            app.graph.setDirtyCanvas(true);
            if (original) return original.apply(this.widgets.folder, arguments);
        };
    }
}

// Handles subfolder widget changes
class SubfolderHandler {
    constructor(widgets) {
        this.widgets = widgets;
    }
    
    setup() {
        const original = this.widgets.subfolder.callback;
        this.widgets.subfolder.callback = async () => {
            const models = await API.getModels(
                this.widgets.modelType.value,
                this.widgets.folder.value,
                this.widgets.subfolder.value
            );
            this.widgets.modelName.options.values = models;
            this.widgets.modelName.value = models[0] || "No models found";
            
            app.graph.setDirtyCanvas(true);
            if (original) return original.apply(this.widgets.subfolder, arguments);
        };
    }
}

// Handles model_name widget changes (sets control to "fixed")
class ModelNameHandler {
    constructor(widgets) {
        this.widgets = widgets;
    }
    
    setup() {
        const original = this.widgets.modelName.callback;
        this.widgets.modelName.callback = () => {
            this.widgets.control.value = "fixed";
            if (original) return original.apply(this.widgets.modelName, arguments);
        };
    }
}

// Sets up all widget callbacks
class CallbackManager {
    constructor(node, widgets) {
        this.node = node;
        this.widgets = widgets;
    }
    
    setupAll() {
        new ModelTypeHandler(this.node, this.widgets).setup();
        new FolderHandler(this.node, this.widgets).setup();
        new SubfolderHandler(this.widgets).setup();
        new ModelNameHandler(this.widgets).setup();
    }
}

// Restores widget state after page reload
class StateManager {
    constructor(node, widgets) {
        this.node = node;
        this.widgets = widgets;
    }
    
    async restore() {
        const saved = {
            folder: this.widgets.folder.value,
            subfolder: this.widgets.subfolder.value,
            model: this.widgets.modelName.value
        };
        
        const folders = await API.getFolders(this.widgets.modelType.value);
        this.widgets.folder.options.values = folders;
        this.widgets.folder.value = saved.folder;
        
        const subfolders = await API.getSubfolders(this.widgets.modelType.value, this.widgets.folder.value);
        
        if (this.widgets.folder.value === "All" || subfolders.length === 1) {
            WidgetVisibility.toggle(this.node, this.widgets.subfolder, false);
        } else {
            this.widgets.subfolder.options.values = subfolders;
            this.widgets.subfolder.value = saved.subfolder;
            WidgetVisibility.toggle(this.node, this.widgets.subfolder, true);
        }
        
        const models = await API.getModels(
            this.widgets.modelType.value,
            this.widgets.folder.value,
            this.widgets.subfolder.value
        );
        this.widgets.modelName.options.values = models;
        this.widgets.modelName.value = saved.model;
    }
    
    initVisibility() {
        if (this.widgets.folder.value === "All") {
            WidgetVisibility.toggle(this.node, this.widgets.subfolder, false);
        }
    }
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
                
                const widgets = {
                    modelType: this.widgets.find(w => w.name === "model_type"),
                    folder: this.widgets.find(w => w.name === "folder"),
                    subfolder: this.widgets.find(w => w.name === "subfolder"),
                    modelName: this.widgets.find(w => w.name === "model_name"),
                    control: this.widgets.find(w => w.name === "after_generate")
                };
                
                if (Object.values(widgets).every(w => w)) {
                    const callbackManager = new CallbackManager(this, widgets);
                    callbackManager.setupAll();
                    
                    const stateManager = new StateManager(this, widgets);
                    stateManager.initVisibility();
                }
            };
            
            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = async function() {
                if (onConfigure) onConfigure.apply(this, arguments);
                
                const widgets = {
                    modelType: this.widgets.find(w => w.name === "model_type"),
                    folder: this.widgets.find(w => w.name === "folder"),
                    subfolder: this.widgets.find(w => w.name === "subfolder"),
                    modelName: this.widgets.find(w => w.name === "model_name"),
                    control: this.widgets.find(w => w.name === "after_generate")
                };
                
                if (Object.values(widgets).every(w => w)) {
                    const stateManager = new StateManager(this, widgets);
                    await stateManager.restore();
                }
            };
        }
    }
});