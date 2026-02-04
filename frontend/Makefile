# LangGraph Chat UI - Makefile
# Usage: make <command>

.PHONY: help setup dev build start clean \
        db-init db-reset db-studio db-generate db-migrate-prod \
        setup-public setup-auth setup-open setup-approval \
        admin-create admin-promote admin-list seed-settings

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

# Check if dependencies are installed
NODE_MODULES := node_modules
PACKAGE_LOCK := pnpm-lock.yaml

help: ## Show this help message
	@echo "$(GREEN)LangGraph Chat UI - Available Commands$(NC)"
	@echo ""
	@echo "$(YELLOW)Setup & Development:$(NC)"
	@grep -E '^(setup|dev|build|start|clean):.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Database:$(NC)"
	@grep -E '^db-.*:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Auth Mode Configuration:$(NC)"
	@grep -E '^setup-(public|auth|open|approval):.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Admin Management:$(NC)"
	@grep -E '^admin-.*:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Settings:$(NC)"
	@grep -E '^seed-.*:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'

# =============================================================================
# Setup & Development
# =============================================================================

install: ## Install dependencies
	@echo "$(GREEN)Installing dependencies...$(NC)"
	@pnpm install

$(NODE_MODULES): $(PACKAGE_LOCK)
	@$(MAKE) install

setup: install db-init seed-settings ## Full initial setup (install, db init, seed)
	@echo ""
	@echo "$(GREEN)Setup complete!$(NC)"
	@echo "Run 'make dev' to start the development server."

dev: $(NODE_MODULES) ## Start development server with hot reload
	@echo "$(GREEN)Starting development server...$(NC)"
	@pnpm dev

build: $(NODE_MODULES) db-generate ## Build for production
	@echo "$(GREEN)Building application...$(NC)"
	@pnpm build

start: ## Start production server
	@echo "$(GREEN)Starting production server...$(NC)"
	@pnpm start

clean: ## Remove node_modules and build artifacts
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	@rm -rf node_modules .next

# =============================================================================
# Database
# =============================================================================

db-init: ## Initialize database with migrations
	@echo "$(GREEN)Initializing database...$(NC)"
	@pnpm prisma migrate dev

db-reset: ## Reset database (WARNING: deletes all data)
	@echo "$(RED)WARNING: This will delete all data in the database!$(NC)"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] && \
		pnpm prisma migrate reset --force || echo "Cancelled"

db-studio: ## Open Prisma Studio
	@pnpm prisma studio

db-generate: ## Generate Prisma client
	@echo "$(GREEN)Generating Prisma client...$(NC)"
	@pnpm prisma generate

db-migrate-prod: ## Deploy migrations to production
	@echo "$(GREEN)Deploying migrations to production...$(NC)"
	@pnpm prisma migrate deploy

# =============================================================================
# Auth Mode Configuration
# =============================================================================

setup-public: ## Configure public mode (no auth required)
	@echo "$(GREEN)Configuring public mode...$(NC)"
	@if grep -q "^AUTH_MODE=" .env 2>/dev/null; then \
		sed -i '' 's/^AUTH_MODE=.*/AUTH_MODE=public/' .env; \
	else \
		echo "AUTH_MODE=public" >> .env; \
	fi
	@echo "Done! AUTH_MODE=public"
	@echo "$(YELLOW)Restart the server for changes to take effect.$(NC)"

setup-auth: ## Configure authenticated mode (login required)
	@echo "$(GREEN)Configuring authenticated mode...$(NC)"
	@if grep -q "^AUTH_MODE=" .env 2>/dev/null; then \
		sed -i '' 's/^AUTH_MODE=.*/AUTH_MODE=authenticated/' .env; \
	else \
		echo "AUTH_MODE=authenticated" >> .env; \
	fi
	@echo "Done! AUTH_MODE=authenticated"
	@echo "$(YELLOW)Restart the server for changes to take effect.$(NC)"

setup-open: ## Configure open registration (auto-approve)
	@echo "$(GREEN)Configuring open registration...$(NC)"
	@if grep -q "^REGISTRATION_POLICY=" .env 2>/dev/null; then \
		sed -i '' 's/^REGISTRATION_POLICY=.*/REGISTRATION_POLICY=open/' .env; \
	else \
		echo "REGISTRATION_POLICY=open" >> .env; \
	fi
	@echo "Done! REGISTRATION_POLICY=open"
	@echo "$(YELLOW)Restart the server for changes to take effect.$(NC)"

setup-approval: ## Configure approval-based registration
	@echo "$(GREEN)Configuring approval-based registration...$(NC)"
	@if grep -q "^REGISTRATION_POLICY=" .env 2>/dev/null; then \
		sed -i '' 's/^REGISTRATION_POLICY=.*/REGISTRATION_POLICY=approval/' .env; \
	else \
		echo "REGISTRATION_POLICY=approval" >> .env; \
	fi
	@echo "Done! REGISTRATION_POLICY=approval"
	@echo "$(YELLOW)Restart the server for changes to take effect.$(NC)"

# =============================================================================
# Admin Management
# =============================================================================

admin-create: ## Create admin account (interactive)
	@read -p "Email: " email && \
	read -s -p "Password: " password && echo && \
	read -p "Name (optional): " name && \
	pnpm dlx tsx scripts/create-admin.ts "$$email" "$$password" "$$name"

admin-promote: ## Promote user to admin (interactive)
	@read -p "Email of user to promote: " email && \
	read -p "Role (admin/super_admin) [super_admin]: " role && \
	pnpm dlx tsx scripts/promote-admin.ts "$$email" "$${role:-super_admin}"

admin-list: ## List all admin users
	@echo "$(GREEN)Admin users:$(NC)"
	@pnpm dlx tsx -e "\
		const { PrismaClient } = require('@prisma/client'); \
		const prisma = new PrismaClient(); \
		(async () => { \
			const admins = await prisma.user.findMany({ \
				where: { role: { in: ['admin', 'super_admin'] } }, \
				select: { email: true, name: true, role: true, status: true } \
			}); \
			if (admins.length === 0) { \
				console.log('  No admin users found'); \
			} else { \
				admins.forEach(a => console.log('  ' + a.email + ' (' + a.role + ') - ' + a.status)); \
			} \
			await prisma.\$$disconnect(); \
		})();"

# =============================================================================
# Settings
# =============================================================================

seed-settings: ## Seed default global settings
	@pnpm dlx tsx scripts/seed-settings.ts

.DEFAULT_GOAL := help
