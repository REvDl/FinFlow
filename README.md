# FinFlow — Full-Stack Personal Finance Manager

FinFlow is a robust, high-performance personal finance management system designed for modern personal accounting. It allows users to track incomes and expenses, manage flexible categories, and analyze financial health with real-time multi-currency conversion and smart data processing.

> **Active Development**: This project is currently in active development. New features are being added, and architectural improvements are made regularly to ensure industry-standard reliability.

## Key Features

- **Secure Authentication**: JWT-based system with Access & Refresh token rotation, Argon2 password hashing, and built-in rate limiting (SlowAPI).
- **Real-time Multi-currency**: Automatic exchange rate synchronization (via NBU API) with Redis caching. View your balance in **USD, EUR, UAH, RUB, or CZK**.
- **Financial Analytics**:
    - Summary dashboards for Balance, Income, and Expenses.
    - Average daily spending and income calculation for specific periods.
    - Real-time balance conversion based on live market rates.
- **Advanced Transaction Management**:
    - **Cursor-based Pagination**: Optimized infinite scrolling for smooth browsing of large transaction histories.
    - **Dynamic Filtering**: Comprehensive data filtering by date range, category, or type.
    - **Smart Date Parsing**: Intelligent input processor (English/Russian support).
- **Data Portability**: Full support for Importing and Exporting financial history via JSON files.
- **Modern UI/UX**: Clean, responsive dashboard with native Dark Mode support.

## Tech Stack

### Backend
![](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)
![](https://img.shields.io/badge/FastAPI-Framework-009688?style=flat-square&logo=fastapi&logoColor=white)
![](https://img.shields.io/badge/PostgreSQL-Database-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![](https://img.shields.io/badge/Redis-Caching-DC382D?style=flat-square&logo=redis&logoColor=white)
![](https://img.shields.io/badge/SQLAlchemy-ORM-D71F00?style=flat-square&logo=sqlalchemy&logoColor=white)
![](https://img.shields.io/badge/Docker-Container-2496ED?style=flat-square&logo=docker&logoColor=white)

### Frontend
![](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![](https://img.shields.io/badge/TypeScript-Language-3178C6?style=flat-square&logo=typescript&logoColor=white)
![](https://img.shields.io/badge/Vite-Tooling-646CFF?style=flat-square&logo=vite&logoColor=white)
![]([https://img.shields.io/badge/Tailwind-Styling-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white](https://img.shields.io/badge/Tailwind-Styling-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white))
![]([https://img.shields.io/badge/TanStack_Query-State-FF4154?style=flat-square&logo=react-query&logoColor=white](https://img.shields.io/badge/TanStack_Query-State-FF4154?style=flat-square&logo=react-query&logoColor=white))

## Project Structure

```text
├── app/                        # FastAPI Application (Endpoints & Main)
├── core/                       # Security, JWT, Dependencies, and Exceptions
├── database/                   # SQLAlchemy Models and Engine setup
├── frontend/                   # React/TypeScript source code
├── limiter/                    # Rate limiting configuration
├── migrations/                 # Database migration history (Alembic)
├── schemes/                    # Pydantic models for data validation
├── services/                   # Business Logic (DAO - Data Access Objects)
├── tests/                      # Integration and Mock test suites
├── .dockerignore               # Docker ignore rules
├── .env                        # Environment variables (Local)
├── .gitattributes              # Git attributes config
├── .gitignore                  # Git ignore rules
├── alembic.ini                 # Alembic configuration
├── config.py                   # Global application configuration
├── docker-compose.test.yml     # Orchestration for testing environment
├── docker-compose.yml          # Production/Dev orchestration config
├── Dockerfile                  # Docker image build instructions
├── pytest.ini                  # Pytest configuration
├── README.md                   # Project documentation
├── repomix-output.xml          # Packed repository for AI analysis
├── requirements.txt            # Backend dependencies
└── script.py                   # External API integration (Currency parsing)
```

## Testing

The system is covered by a comprehensive test suite to ensure reliability and security. 
```bash
pytest
```

## Security & Performance

*   **Brute-force protection**: Strict rate limiting implemented on sensitive endpoints.
*   **Data Integrity**: Powered by **Pydantic v2**, ensuring strict validation at the schema level.
*   **Asynchronous Architecture**: Fully non-blocking I/O operations for high concurrency.
*   **Secure Data Storage**: Professional standards using HttpOnly, Secure, and SameSite cookie attributes.

---
*Note: Local deployment instructions and environment configurations are restricted for security reasons. For access or inquiries, please contact the repository owner.*