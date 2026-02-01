import { app } from "../../scripts/app.js";

class WidgetPropsStorage {
    constructor() {
        this.props = {};
    }
    
    save(widgetName, type, computeSize) {
        if (!this.props[widgetName]) {
            this.props[widgetName] = { type, computeSize };
        }
    }
    
    get(widgetName) {
        return this.props[widgetName];
    }
}

class WidgetToggler {
    constructor(storage) {
        this.storage = storage;
    }
    
    toggle(node, widget, show) {
        if (!widget) return;
        
        this.storage.save(widget.name, widget.type, widget.computeSize);
        
        const origSize = node.size;
        const saved = this.storage.get(widget.name);
        
        widget.type = show ? saved.type : "hidden";
        widget.computeSize = show ? saved.computeSize : () => [0, -4];
        
        const height = show ? Math.max(node.computeSize()[1], origSize[1]) : node.size[1];
        node.setSize([node.size[0], height]);
    }
}

class ModelSelectorAPI {
    async fetchFolders(modelType) {
        const url = `/model_selector/folders?type=${encodeURIComponent(modelType)}`;
        const response = await fetch(url);
        return response.json();
    }
    
    async fetchSubfolders(modelType, folder) {
        const url = `/model_selector/subfolders?type=${encodeURIComponent(modelType)}&folder=${encodeURIComponent(folder)}`;
        const response = await fetch(url);
        return response.json();
    }
    
    async fetchModels(modelType, folder, subfolder) {
        const url = `/model_selector/models?type=${encodeURIComponent(modelType)}&folder=${encodeURIComponent(folder)}&subfolder=${encodeURIComponent(subfolder)}`;
        const response = await fetch(url);
        return response.json();
    }
}

class WidgetGroup {
    constructor(node) {
        this.modelType = node.widgets.find(w => w.name === "model_type");
        this.folder = node.widgets.find(w => w.name === "folder");
        this.subfolder = node.widgets.find(w => w.name === "subfolder");
        this.modelName = node.widgets.find(w => w.name === "model_name");
        this.control = node.widgets.find(w => w.name === "control_after_generate");
    }
    
    isValid() {
        return this.modelType && this.folder && this.subfolder && this.modelName && this.control;
    }
}

class ModelTypeHandler {
    constructor(widgets, api, toggler, node) {
        this.widgets = widgets;
        this.api = api;
        this.toggler = toggler;
        this.node = node;
        this.originalCallback = null;
    }
    
    setup() {
        this.originalCallback = this.widgets.modelType.callback;
        this.widgets.modelType.callback = async () => await this.handleChange();
    }
    
    async handleChange() {
        const folders = await this.api.fetchFolders(this.widgets.modelType.value);
        this.widgets.folder.options.values = folders;
        this.widgets.folder.value = "All";
        
        this.toggler.toggle(this.node, this.widgets.subfolder, false);
        
        const models = await this.api.fetchModels(this.widgets.modelType.value, "All", "All");
        this.widgets.modelName.options.values = models;
        this.widgets.modelName.value = models[0] || "No models found";
        
        app.graph.setDirtyCanvas(true);
        
        if (this.originalCallback) {
            return this.originalCallback.apply(this.widgets.modelType, arguments);
        }
    }
}

class FolderHandler {
    constructor(widgets, api, toggler, node) {
        this.widgets = widgets;
        this.api = api;
        this.toggler = toggler;
        this.node = node;
        this.originalCallback = null;
    }
    
    setup() {
        this.originalCallback = this.widgets.folder.callback;
        this.widgets.folder.callback = async () => await this.handleChange();
    }
    
    async handleChange() {
        const subfolders = await this.api.fetchSubfolders(this.widgets.modelType.value, this.widgets.folder.value);
        
        if (this.widgets.folder.value === "All" || subfolders.length === 1) {
            this.toggler.toggle(this.node, this.widgets.subfolder, false);
            this.widgets.subfolder.value = "All";
        } else {
            this.widgets.subfolder.options.values = subfolders;
            this.widgets.subfolder.value = "All";
            this.toggler.toggle(this.node, this.widgets.subfolder, true);
        }
        
        const models = await this.api.fetchModels(this.widgets.modelType.value, this.widgets.folder.value, "All");
        this.widgets.modelName.options.values = models;
        this.widgets.modelName.value = models[0] || "No models found";
        
        app.graph.setDirtyCanvas(true);
        
        if (this.originalCallback) {
            return this.originalCallback.apply(this.widgets.folder, arguments);
        }
    }
}

class SubfolderHandler {
    constructor(widgets, api) {
        this.widgets = widgets;
        this.api = api;
        this.originalCallback = null;
    }
    
    setup() {
        this.originalCallback = this.widgets.subfolder.callback;
        this.widgets.subfolder.callback = async () => await this.handleChange();
    }
    
    async handleChange() {
        const models = await this.api.fetchModels(
            this.widgets.modelType.value,
            this.widgets.folder.value,
            this.widgets.subfolder.value
        );
        this.widgets.modelName.options.values = models;
        this.widgets.modelName.value = models[0] || "No models found";
        
        app.graph.setDirtyCanvas(true);
        
        if (this.originalCallback) {
            return this.originalCallback.apply(this.widgets.subfolder, arguments);
        }
    }
}

class ModelNameHandler {
    constructor(widgets) {
        this.widgets = widgets;
        this.originalCallback = null;
    }
    
    setup() {
        this.originalCallback = this.widgets.modelName.callback;
        this.widgets.modelName.callback = () => this.handleChange();
    }
    
    handleChange() {
        this.widgets.control.value = "fixed";
        
        if (this.originalCallback) {
            return this.originalCallback.apply(this.widgets.modelName, arguments);
        }
    }
}

class CallbackSetup {
    constructor(widgets, api, toggler, node) {
        this.typeHandler = new ModelTypeHandler(widgets, api, toggler, node);
        this.folderHandler = new FolderHandler(widgets, api, toggler, node);
        this.subfolderHandler = new SubfolderHandler(widgets, api);
        this.modelHandler = new ModelNameHandler(widgets);
    }
    
    setupAll() {
        this.typeHandler.setup();
        this.folderHandler.setup();
        this.subfolderHandler.setup();
        this.modelHandler.setup();
    }
}

class StateRestorer {
    constructor(widgets, api, toggler, node) {
        this.widgets = widgets;
        this.api = api;
        this.toggler = toggler;
        this.node = node;
    }
    
    async restore() {
        const saved = this.saveCurrentValues();
        await this.restoreFolders(saved.folder);
        await this.restoreSubfolders(saved.subfolder);
        await this.restoreModels(saved.model);
    }
    
    saveCurrentValues() {
        return {
            folder: this.widgets.folder.value,
            subfolder: this.widgets.subfolder.value,
            model: this.widgets.modelName.value
        };
    }
    
    async restoreFolders(savedFolder) {
        const folders = await this.api.fetchFolders(this.widgets.modelType.value);
        this.widgets.folder.options.values = folders;
        this.widgets.folder.value = savedFolder;
    }
    
    async restoreSubfolders(savedSubfolder) {
        const subfolders = await this.api.fetchSubfolders(this.widgets.modelType.value, this.widgets.folder.value);
        
        if (this.widgets.folder.value === "All" || subfolders.length === 1) {
            this.widgets.subfolder.options.values = subfolders;
            this.widgets.subfolder.value = "All";
            this.toggler.toggle(this.node, this.widgets.subfolder, false);
        } else {
            this.widgets.subfolder.options.values = subfolders;
            this.widgets.subfolder.value = subfolders.includes(savedSubfolder) ? savedSubfolder : "All";
            this.toggler.toggle(this.node, this.widgets.subfolder, true);
        }
    }
    
    async restoreModels(savedModel) {
        const models = await this.api.fetchModels(
            this.widgets.modelType.value,
            this.widgets.folder.value,
            this.widgets.subfolder.value
        );
        this.widgets.modelName.options.values = models;
        this.widgets.modelName.value = savedModel;
    }
}

class InitialVisibility {
    constructor(widgets, toggler, node) {
        this.widgets = widgets;
        this.toggler = toggler;
        this.node = node;
    }
    
    apply() {
        if (this.widgets.folder.value === "All") {
            this.toggler.toggle(this.node, this.widgets.subfolder, false);
        }
    }
}

class ModelSelectorNode {
    constructor(node) {
        this.node = node;
        this.widgets = new WidgetGroup(node);
        this.storage = new WidgetPropsStorage();
        this.toggler = new WidgetToggler(this.storage);
        this.api = new ModelSelectorAPI();
    }
    
    setupCallbacks() {
        if (!this.widgets.isValid()) return;
        
        const setup = new CallbackSetup(this.widgets, this.api, this.toggler, this.node);
        setup.setupAll();
    }
    
    async restoreState() {
        if (!this.widgets.isValid()) return;
        
        const restorer = new StateRestorer(this.widgets, this.api, this.toggler, this.node);
        await restorer.restore();
    }
    
    initializeVisibility() {
        if (!this.widgets.isValid()) return;
        
        const visibility = new InitialVisibility(this.widgets, this.toggler, this.node);
        visibility.apply();
    }
    
    updateModelName(value) {
        if (this.widgets.modelName) {
            this.widgets.modelName.value = value;
            app.graph.setDirtyCanvas(true);
        }
    }
}

class NodeExtension {
    register() {
        app.registerExtension({
            name: "ModelNameSelector",
            async beforeRegisterNodeDef(nodeType, nodeData) {
                if (nodeData.name !== "ModelNameSelector") return;
                
                this.setupOnExecuted(nodeType);
                this.setupOnNodeCreated(nodeType);
                this.setupOnConfigure(nodeType);
            },
            
            setupOnExecuted(nodeType) {
                const original = nodeType.prototype.onExecuted;
                nodeType.prototype.onExecuted = function(message) {
                    if (original) original.apply(this, arguments);
                    
                    if (message?.model_name) {
                        if (!this.modelSelector) {
                            this.modelSelector = new ModelSelectorNode(this);
                        }
                        this.modelSelector.updateModelName(message.model_name[0]);
                    }
                };
            },
            
            setupOnNodeCreated(nodeType) {
                const original = nodeType.prototype.onNodeCreated;
                nodeType.prototype.onNodeCreated = async function() {
                    if (original) original.apply(this, arguments);
                    
                    this.modelSelector = new ModelSelectorNode(this);
                    this.modelSelector.setupCallbacks();
                    this.modelSelector.initializeVisibility();
                };
            },
            
            setupOnConfigure(nodeType) {
                const original = nodeType.prototype.onConfigure;
                nodeType.prototype.onConfigure = async function() {
                    if (original) original.apply(this, arguments);
                    
                    if (!this.modelSelector) {
                        this.modelSelector = new ModelSelectorNode(this);
                    }
                    await this.modelSelector.restoreState();
                };
            }
        });
    }
}

const extension = new NodeExtension();
extension.register();