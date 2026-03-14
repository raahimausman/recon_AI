# backend/api/dependencies.py
from functools import lru_cache
from ..config import llm

@lru_cache
def get_llm_client():
    # in case you want to share the llm client across endpoints
    return llm
