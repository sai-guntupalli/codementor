from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.admin import router as admin_router
from api.auth import router as auth_router
from api.dashboard import router as dashboard_router
from api.bookmarks import router as bookmarks_router
from api.execute import router as execute_router
from api.learning_paths import router as learning_paths_router
from api.llm import router as llm_router
from api.curriculum import router as curriculum_router
from api.health import router as health_router
from api.practice import router as practice_router
from api.problems import router as problems_router
from api.submissions import router as submissions_router
from api.plans import router as plans_router
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
app.include_router(dashboard_router)
app.include_router(auth_router)
app.include_router(bookmarks_router)
app.include_router(problems_router)
app.include_router(practice_router)
app.include_router(curriculum_router)
app.include_router(learning_paths_router)
app.include_router(users_router)
app.include_router(plans_router)
app.include_router(admin_router)
app.include_router(submissions_router)
app.include_router(llm_router)
app.include_router(execute_router)
