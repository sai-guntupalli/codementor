from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.auth import router as auth_router
from api.llm import router as llm_router
from api.curriculum import router as curriculum_router
from api.health import router as health_router
from api.practice import router as practice_router
from api.problems import router as problems_router
from api.submissions import router as submissions_router
from api.users import router as users_router
from core.config import settings

app = FastAPI(title=settings.app_name, debug=settings.debug)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(problems_router)
app.include_router(practice_router)
app.include_router(curriculum_router)
app.include_router(users_router)
app.include_router(submissions_router)
app.include_router(llm_router)
