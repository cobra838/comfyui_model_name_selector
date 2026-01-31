import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "ModelNameSelector",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "ModelNameSelector") {
            const onExecuted = nodeType.prototype.onExecuted;
            
            nodeType.prototype.onExecuted = function(message) {
                if (onExecuted) {
                    onExecuted.apply(this, arguments);
                }
                
                // Обновляем виджет после выполнения
                if (message && message.model_name) {
                    const modelWidget = this.widgets.find(w => w.name === "model_name");
                    if (modelWidget) {
                        const newValue = message.model_name[0];
                        console.log(`[ModelNameSelector] Updating widget to: ${newValue}`);
                        modelWidget.value = newValue;
                        
                        // Принудительно обновляем отображение
                        if (this.onResize) {
                            this.onResize(this.size);
                        }
                        app.graph.setDirtyCanvas(true);
                    }
                }
            };
        }
    }
});