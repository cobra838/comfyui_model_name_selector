"""Model management utilities for ModelNameSelector."""

import folder_paths
from typing import List, Set


class ModelManager:
    """Manages model file discovery and organization."""
    
    FOLDER_TYPES = {
        "Checkpoints": "checkpoints",
        "Diffusion Models": "diffusion_models",
        "GGUF": "unet_gguf"
    }
    
    @classmethod
    def get_models_by_type(cls, model_type: str) -> List[str]:
        """Get list of models filtered by type."""
        models = []
        
        if model_type in ["All", "Checkpoints"]:
            models.extend(folder_paths.get_filename_list("checkpoints"))
        if model_type in ["All", "Diffusion Models"]:
            models.extend(folder_paths.get_filename_list("diffusion_models"))
        if model_type in ["All", "GGUF"]:
            models.extend(folder_paths.get_filename_list("unet_gguf"))
        
        return models
    
    @classmethod
    def get_folders(cls, model_type: str) -> List[str]:
        """Extract unique top-level folders from models."""
        models = cls.get_models_by_type(model_type)
        folders: Set[str] = {"All"}
        
        for model in models:
            if '\\' in model or '/' in model:
                separator = '\\' if '\\' in model else '/'
                folder = model.split(separator)[0]
                folders.add(folder)
            else:
                folders.add("(Root)")
        
        return sorted(folders, key=lambda x: (x == "All", x == "(Root)", x))
    
    @classmethod
    def get_subfolders(cls, model_type: str, folder: str) -> List[str]:
        """Extract subfolders from a specific folder."""
        if folder == "All" or folder == "(Root)":
            return ["All"]
        
        models = cls.get_models_by_type(model_type)
        subfolders: Set[str] = {"All"}
        
        for model in models:
            if model.startswith(folder + '\\') or model.startswith(folder + '/'):
                separator = '\\' if '\\' in model else '/'
                path_without_folder = model.replace(folder + separator, '', 1)
                parts = path_without_folder.split(separator)
                
                if len(parts) > 1:
                    subfolders.add(parts[0])
        
        return sorted(subfolders, key=lambda x: x == "All")
    
    @classmethod
    def filter_models(cls, models: List[str], folder: str, subfolder: str) -> List[str]:
        """Filter models by folder and subfolder."""
        if folder == "All":
            return models
        
        if folder == "(Root)":
            return [m for m in models if '\\' not in m and '/' not in m]
        
        # Filter by folder
        filtered = [m for m in models if m.startswith(folder + '\\') or m.startswith(folder + '/')]
        
        # Filter by subfolder if specified
        if subfolder != "All" and filtered:
            separator = '\\' if '\\' in filtered[0] else '/'
            prefix = folder + separator + subfolder + separator
            filtered = [m for m in filtered if m.startswith(prefix)]
        
        return filtered
    
    @classmethod
    def get_models(cls, model_type: str, folder: str, subfolder: str) -> List[str]:
        """Get filtered and sorted list of models."""
        models = cls.get_models_by_type(model_type)
        models = cls.filter_models(models, folder, subfolder)
        return sorted(models) if models else ["No models found"]
