"""Favorites management for ModelNameSelector."""

import json
import os
from typing import List
import folder_paths


class FavoritesManager:
    """Manages favorite models storage."""
    
    # TODO: what is default user path
    FAVORITES_FILE = os.path.join(
        folder_paths.get_user_directory(), 
        "model_selector", 
        "favorites.json"
    )
    
    @classmethod
    def load_favorites(cls) -> List[str]:
        """Load favorites from file."""
        os.makedirs(os.path.dirname(cls.FAVORITES_FILE), exist_ok=True)
        if not os.path.exists(cls.FAVORITES_FILE):
            return []
        
        try:
            with open(cls.FAVORITES_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return []
    
    @classmethod
    def save_favorites(cls, favorites: List[str]) -> None:
        """Save favorites to file."""
        with open(cls.FAVORITES_FILE, 'w', encoding='utf-8') as f:
            json.dump(favorites, f, indent=2, ensure_ascii=False)
    
    @classmethod
    def add_favorite(cls, model: str) -> List[str]:
        """Add model to favorites."""
        favorites = cls.load_favorites()
        if model not in favorites:
            favorites.append(model)
            cls.save_favorites(favorites)
        return favorites
    
    @classmethod
    def remove_favorite(cls, model: str) -> List[str]:
        """Remove model from favorites."""
        favorites = cls.load_favorites()
        if model in favorites:
            favorites.remove(model)
            cls.save_favorites(favorites)
        return favorites
    
    @classmethod
    def is_favorite(cls, model: str) -> bool:
        """Check if model is in favorites."""
        return model in cls.load_favorites()
    
    @classmethod
    def has_favorites(cls) -> bool:
        """Check if there are any favorites."""
        return len(cls.load_favorites()) > 0
