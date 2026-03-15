  
**TIMECOIN**

Project Roadmap & Technical Blueprint

*A Contribution-Based Digital Currency Platform*

Prepared: March 2026

Version 1.0 — Centralized Prototype Phase

# **1\. Vision & Core Principles**

TimeCoin is a contribution-based digital currency where value is earned through positive participation — not purchased with capital advantage. The centralized prototype validates the economic model before any decentralization effort.

## **Core Economic Rules**

| Rule | Description |
| :---- | :---- |
| Earning | Users earn TimeCoin through verified positive contributions: completing tasks, creating quality content, community moderation, platform participation |
| Spending | Users spend TimeCoin on marketplace goods/services, tipping creators, requesting tasks from other users |
| No Interest | Holding TimeCoin generates zero interest — eliminates passive wealth accumulation |
| Hoarding Cap | Hard ceiling on maximum TimeCoin per account (e.g., 10,000 TC). Excess must be spent or donated to community pool |
| Community Tax | Progressive tax on holdings: higher balances taxed at higher rates. Revenue funds platform development and community grants |
| No/Minimal Fees | Transactions between users are free. Optional micro-fee (\< 0.1%) goes to community treasury |
| Fiat Gateway | Users can purchase TimeCoin with real money. All revenue goes exclusively to platform improvement — no profit extraction |
| Anti-Spam | Content earning requires quality thresholds. Rate limiting, reputation scoring, and community flagging prevent abuse |

## **What This Is NOT**

*TimeCoin is not a speculative cryptocurrency. There is no trading, no exchange listing, no price volatility by design. It is a closed-loop utility token for a contribution economy. This distinction matters for both user expectations and legal compliance.*

# **2\. Technology Stack Decision**

For the centralized prototype, we optimize for speed of iteration, zero infrastructure cost, and the ability for a single developer to build end-to-end.

## **Chosen Stack**

| Layer | Technology | Rationale |
| :---- | :---- | :---- |
| Frontend | Vite \+ React \+ TypeScript | Fast builds, type safety, SPA deployable to GitHub Pages |
| UI Framework | Tailwind CSS \+ shadcn/ui | Rapid prototyping, consistent design, accessible components |
| Backend/DB | Supabase (PostgreSQL) | Auth, real-time subscriptions, Row Level Security, storage — all in one |
| Hosting | GitHub Pages (SPA) | Free, version-controlled, zero config deployment with GitHub Actions |
| State Mgmt | Zustand or React Context | Lightweight, sufficient for prototype scale |
| Realtime | Supabase Realtime | WebSocket subscriptions for live balance updates, notifications, feed |
| File Storage | Supabase Storage | Image/video uploads for social content, profile pictures |
| Scheduled Jobs | Supabase Edge Functions \+ pg\_cron | Community tax calculation, anti-spam scoring, periodic cleanup |

## **Why NOT Next.js**

Next.js requires a server runtime (Vercel/Node) which adds cost and complexity for a prototype. Since Supabase handles all backend logic through its API, RLS policies, and Edge Functions, the frontend is purely a client-side SPA. Vite \+ React on GitHub Pages gives you zero hosting cost with no capability loss for this stage.

## **Future Migration Path**

When the prototype validates the model: move frontend to Next.js on Vercel for SSR/SEO, migrate from Supabase to self-hosted PostgreSQL \+ custom API for full control, then implement DAG-based decentralization for the ledger layer. Each migration is independent and non-blocking.

# **3\. Development Roadmap**

## **Phase 1: Foundation (Weeks 1–3)**

**Goal: User accounts, wallet system, and basic transactions working end-to-end.**

| Sprint | Feature | Details | Deliverable |
| :---- | :---- | :---- | :---- |
| Week 1 | Project setup | Vite \+ React \+ TS \+ Tailwind \+ Supabase client. GitHub Pages CI/CD. Supabase project with auth enabled. | Deployed skeleton app with login/register |
| Week 1 | Database schema | Users, wallets, transactions, ledger tables. RLS policies for security. | Migration files \+ seed data |
| Week 2 | Auth system | Email/password \+ OAuth (Google/GitHub). Profile creation on signup. Auto-create wallet with 0 TC balance. | Working auth flow |
| Week 2 | Wallet core | Balance display, transaction history, send TC to another user by username/email. Server-side balance validation. | P2P transfer working |
| Week 3 | Hoarding cap | DB constraint \+ edge function: reject transactions that would exceed cap. Overflow options: donate to community pool. | Cap enforcement active |
| Week 3 | Community tax | pg\_cron job: daily/weekly progressive tax deduction. Tax brackets configurable. Tax revenue visible in community treasury. | Automated tax running |

## **Phase 2: Social Platform (Weeks 4–6)**

**Goal: Users can create content, interact, and earn TimeCoin for quality contributions.**

| Sprint | Feature | Details | Deliverable |
| :---- | :---- | :---- | :---- |
| Week 4 | Content feed | Post text, images, short videos. Supabase Storage for media. Chronological \+ quality-ranked feed. | Working social feed |
| Week 4 | Interactions | Like, comment, share, tip (send TC to content creator). Notification system via Supabase Realtime. | Engagement system live |
| Week 5 | Reputation system | Quality score per user based on: content engagement, community flags, task completion rate. Score affects earning rate. | Reputation visible on profiles |
| Week 5 | Anti-spam | Rate limiting on posts (max N per day). Minimum reputation to earn from content. Community flagging with auto-hide threshold. | Spam protection active |
| Week 6 | Earning engine | Edge function calculates TC rewards: base amount per quality post, bonus for high engagement, multiplier for reputation. Configurable parameters. | Users earning TC from content |
| Week 6 | Content moderation | Report system, moderator roles, appeal process. Moderators earn TC for quality moderation work. | Moderation workflow live |

## **Phase 3: Marketplace (Weeks 7–9)**

**Goal: Users can offer and request services/goods, pay with TimeCoin.**

| Sprint | Feature | Details | Deliverable |
| :---- | :---- | :---- | :---- |
| Week 7 | Task board | Users post tasks with TC bounty. Others can claim, submit, and get paid on approval. Dispute resolution flow. | Task marketplace live |
| Week 7 | Escrow system | TC locked in escrow when task is posted. Released to worker on approval, returned to poster on cancellation/dispute. | Escrow working |
| Week 8 | Service listings | Users list ongoing services (tutoring, design, writing). Fixed or hourly TC pricing. Reviews and ratings. | Service marketplace live |
| Week 8 | Search & discovery | Full-text search on tasks, services, content. Category tags, filters, trending. | Discovery system working |
| Week 9 | Fiat gateway | Stripe integration: buy TC with USD. All revenue to platform treasury. Transparent spending reports. | Fiat purchase working |
| Week 9 | Treasury dashboard | Public dashboard showing: total TC in circulation, community tax collected, fiat revenue, spending allocation. | Transparency dashboard live |

## **Phase 4: Polish & Validation (Weeks 10–12)**

**Goal: Production-ready prototype, real user testing, data-driven validation of the economic model.**

| Sprint | Feature | Details | Deliverable |
| :---- | :---- | :---- | :---- |
| Week 10 | Mobile responsive | Full mobile-first redesign. PWA support for install-to-homescreen. | Mobile-ready app |
| Week 10 | Notifications | Push notifications (web), email digests, in-app notification center. | Notification system live |
| Week 11 | Analytics | Admin dashboard: DAU/MAU, TC velocity, Gini coefficient of holdings, tax revenue trends, content quality metrics. | Analytics dashboard |
| Week 11 | Economic tuning | A/B test earning rates, tax brackets, cap levels. Parameter dashboard for live adjustment. | Tuning tools live |
| Week 12 | Beta launch | Invite-only beta with 50–100 users. Feedback collection, bug bounty (in TC), iterate. | Beta running with real users |
| Week 12 | Documentation | User guide, API docs, economic whitepaper, open-source contribution guide. | Docs published |

# **4\. Core Database Schema**

The following tables form the backbone of the TimeCoin system. All monetary operations use database transactions with RLS policies for security.

## **Key Tables**

* profiles — User profile (display name, avatar, bio, reputation\_score, role). Linked to Supabase auth.users.

* wallets — One per user. Fields: balance (numeric, NOT NULL, \>= 0), lifetime\_earned, lifetime\_spent. Check constraint: balance \<= HOARDING\_CAP.

* transactions — Immutable ledger. Fields: from\_wallet, to\_wallet, amount, type (transfer/earning/tax/purchase/escrow), description, created\_at.

* posts — Social content. Fields: author\_id, content\_text, media\_urls\[\], post\_type, quality\_score, engagement\_count, earning\_eligible.

* tasks — Marketplace tasks. Fields: poster\_id, worker\_id, title, description, bounty\_amount, status (open/claimed/submitted/approved/disputed), escrow\_tx\_id.

* services — Ongoing service listings. Fields: provider\_id, title, description, price\_tc, price\_type (fixed/hourly), rating\_avg.

* community\_treasury — Single row tracking: total\_balance, total\_tax\_collected, total\_fiat\_revenue, total\_spent. All mutations via edge functions only.

## **Critical Constraints**

* All TC mutations happen inside PostgreSQL transactions — no application-level balance management.

* Wallet balance is NEVER negative (CHECK constraint).

* Wallet balance NEVER exceeds hoarding cap (CHECK constraint \+ trigger).

* Transaction table is append-only — no updates or deletes via RLS.

* Tax deductions create transaction records with type \= 'tax' for full auditability.

# **5\. Community Tax Design**

Progressive tax on TimeCoin holdings, calculated and deducted automatically on a configurable schedule (daily recommended for prototype).

## **Example Tax Brackets**

| Balance Range (TC) | Daily Rate | Weekly Equivalent | Effect |
| :---- | :---- | :---- | :---- |
| 0 – 100 | 0% | 0% | Small holders untouched |
| 101 – 500 | 0.01% | 0.07% | Negligible for active users |
| 501 – 2,000 | 0.05% | 0.35% | Encourages spending |
| 2,001 – 5,000 | 0.1% | 0.7% | Strong incentive to circulate |
| 5,001 – 10,000 (cap) | 0.2% | 1.4% | Near-cap holders taxed most |

*These are starting values. The economic tuning dashboard (Phase 4\) allows live adjustment based on real circulation data.*

# **6\. Anti-Spam & Quality System**

The biggest risk to a contribution-based currency is spam farming. Multiple layers of defense are required.

* Rate Limits: Maximum posts per day (e.g., 10). Maximum task claims per day (e.g., 5). Cooldown between transactions.

* Reputation Gating: New accounts start with base reputation. Below threshold \= no earning from content. Reputation earned through sustained quality participation over time.

* Community Flagging: Users can flag content as spam/low-quality. Flagged content hidden from feed after threshold. Repeated offenders get earning privileges suspended.

* Quality Scoring: Automated scoring based on: content length, engagement ratio, uniqueness, account age. Only content above quality threshold generates TC rewards.

* Moderator Layer: Trusted users (high reputation) serve as moderators. Moderators earn TC for accurate moderation decisions. Bad moderation decisions reduce moderator reputation.

# **7\. Project Structure**

Recommended folder structure for the Vite \+ React \+ TypeScript \+ Supabase project:

timecoin/├── src/│   ├── components/          \# Reusable UI components│   │   ├── ui/              \# shadcn/ui base components│   │   ├── layout/          \# Header, Sidebar, Footer│   │   ├── wallet/          \# Balance, TransactionList, SendForm│   │   ├── feed/            \# PostCard, CreatePost, FeedList│   │   ├── marketplace/     \# TaskCard, ServiceListing, Escrow│   │   └── admin/           \# Treasury, Analytics, TaxConfig│   ├── pages/               \# Route-level page components│   ├── hooks/               \# Custom React hooks (useWallet, useAuth, useFeed)│   ├── lib/                 \# Supabase client, utils, constants│   ├── stores/              \# Zustand stores (wallet, auth, feed state)│   ├── types/               \# TypeScript interfaces and types│   └── App.tsx              \# Router \+ auth provider├── supabase/│   ├── migrations/          \# SQL migration files│   ├── functions/           \# Edge Functions (tax calc, earning engine)│   └── seed.sql             \# Test data├── public/                  \# Static assets├── .github/workflows/       \# GitHub Actions for Pages deployment├── vite.config.ts├── tailwind.config.ts└── package.json

# **8\. Open Questions to Resolve**

These design decisions should be made before or during Phase 1\. They significantly affect the economic model.

* What is the hoarding cap? (Suggested: 10,000 TC to start, adjustable via admin dashboard.)

* What is the initial earning rate for content? (Suggested: 1–5 TC per quality post, tunable.)

* What is the fiat exchange rate? (Suggested: $1 \= 100 TC to start. This is arbitrary since TC has no external market.)

* How much TC do new users receive on signup? (Suggested: 50 TC welcome bonus to enable immediate participation.)

* Should there be a minimum reputation to post content, or only to earn from it? (Suggested: anyone can post, but earning requires reputation \> threshold.)

* What is the dispute resolution process for marketplace tasks? (Suggested: community jury of 3 random high-reputation users.)

* What legal structure is needed? (This depends on jurisdiction. Consult a lawyer before the fiat gateway goes live.)

# **9\. Honest Risk Assessment**

| Risk | Why It Matters | Mitigation |
| :---- | :---- | :---- |
| Cold start problem | Platform is useless with \< 50 active users. No tasks, no content, no reason to earn TC. | Seed with a specific community (e.g., freelancer group). YOU must be the first power user. |
| Regulatory risk | Selling TC for fiat may classify as money transmission depending on jurisdiction. | Delay fiat gateway until legal review. Start with TC as pure reputation token. |
| Economic death spiral | If tax is too high, users leave. If earning is too easy, TC inflates to worthlessness. | Start conservative. Build analytics dashboard early. Tune based on real data, not theory. |
| Spam/Sybil attacks | Users create multiple accounts to farm TC. | Phone verification, IP-based rate limiting, manual review for early beta. |
| Scope creep | Trying to build social media \+ marketplace \+ banking simultaneously. | Phase discipline. Do NOT start Phase 2 until Phase 1 is solid. Ship the wallet first. |

# **10\. Claude Code Implementation Prompt**

**Copy the following prompt to Claude Code to begin Phase 1 implementation. Each phase has its own prompt — do NOT send all phases at once. Complete and test each phase before proceeding.**

## **Phase 1 Prompt: Foundation**

Build the foundation for "TimeCoin" \- a contribution-based digital currency web app.TECH STACK (non-negotiable):- Vite \+ React 18 \+ TypeScript (strict mode)- Tailwind CSS \+ shadcn/ui for components- Supabase for auth, database, realtime, storage- React Router v6 for routing- Zustand for state management- Deploy target: GitHub Pages (SPA with hash router)PHASE 1 SCOPE \- Build these features:1. PROJECT SETUP- Initialize Vite \+ React \+ TS project- Configure Tailwind \+ shadcn/ui- Set up Supabase client with environment variables- GitHub Actions workflow for GitHub Pages deployment- HashRouter (required for GitHub Pages)2. DATABASE SCHEMA (Supabase migrations)- profiles table: id (FK to auth.users), display\_name, avatar\_url, bio, reputation\_score (default 0), role (user/moderator/admin), created\_at- wallets table: id, user\_id (FK, unique), balance (numeric, default 0, CHECK \>= 0, CHECK \<= 10000), lifetime\_earned, lifetime\_spent, created\_at, updated\_at- transactions table: id, from\_wallet\_id (nullable for system), to\_wallet\_id (nullable for system), amount (numeric, \> 0), type (enum: transfer/earning/tax/purchase/escrow/welcome\_bonus), description, created\_at- community\_treasury table: single row, total\_balance, total\_tax\_collected, total\_fiat\_revenue- RLS policies: users can read own profile/wallet, read any public profile, insert transactions only through RPC functions- Database function: create\_profile\_and\_wallet() \- trigger on auth.users insert3. AUTH SYSTEM- Login page with email/password- Register page with email/password \+ display name- Auto-create profile \+ wallet on registration with 50 TC welcome bonus- Protected routes (redirect to login if not authenticated)- Auth state persisted via Supabase session4. WALLET SYSTEM- Dashboard showing current balance, lifetime earned/spent- Transaction history with pagination, type filters- Send TC form: recipient (by username), amount, description- Server-side RPC function for transfers: validate sender balance, validate recipient exists, validate amount \<= sender balance, validate recipient won't exceed cap, debit sender \+ credit recipient in single transaction, create transaction record- Real-time balance updates via Supabase Realtime subscription5. COMMUNITY TAX (Edge Function \+ pg\_cron)- Edge function: calculate\_community\_tax()- Progressive brackets: 0-100 TC \= 0%, 101-500 \= 0.01%/day, 501-2000 \= 0.05%/day, 2001-5000 \= 0.1%/day, 5001-10000 \= 0.2%/day- Creates transaction records with type 'tax' for each deduction- Credits community\_treasury- pg\_cron schedule: runs daily at midnight UTC6. UI/UX- Clean, modern layout with sidebar navigation- Dashboard: wallet overview \+ recent transactions- Send page: transfer form with validation- Profile page: view/edit own profile- Responsive design (mobile-first)- Loading states, error handling, toast notificationsCONSTRAINTS:- All monetary operations MUST use Supabase RPC functions (not client-side updates)- Transaction table is append-only (no update/delete in RLS)- Use TypeScript strict mode throughout- Handle all error cases with user-friendly messages- Include proper loading states for all async operationsDO NOT build: social feed, marketplace, content system, fiat gateway. Those are Phase 2+.

## **Phase 2 Prompt: Social Platform**

***Send this ONLY after Phase 1 is complete and tested:***

Continue building TimeCoin. Phase 1 (auth, wallet, transactions, tax) is complete.PHASE 2 SCOPE \- Social Platform:1. CONTENT SYSTEM- posts table: id, author\_id, content\_text, media\_urls (text\[\]), post\_type (text/image/video), quality\_score (default 0), engagement\_count (default 0), earning\_eligible (boolean), is\_hidden (boolean), created\_at- post\_interactions table: id, post\_id, user\_id, type (like/comment/tip/flag), comment\_text (nullable), tip\_amount (nullable), created\_at- RLS: anyone can read non-hidden posts, only author can create, interactions only by authenticated users2. SOCIAL FEED- Feed page: chronological \+ "quality" sort toggle- Create post: text \+ optional image upload (Supabase Storage)- Post card: content, author info, like count, comment count, tip button- Like/unlike toggle- Comment section (expandable)- Tip button: sends TC from viewer to author (uses existing transfer RPC)3. REPUTATION SYSTEM- Update profiles.reputation\_score via Edge Function- Score calculation: \+1 per like received, \+2 per task completed, \-5 per valid spam flag, \+10 per week of active participation- Reputation badge on profile and post cards- Minimum reputation of 10 to earn TC from content4. EARNING ENGINE (Edge Function)- Runs hourly or on-demand- For each earning\_eligible post created in last period:  \- Base reward: 1 TC per post  \- Engagement bonus: \+0.5 TC per 10 likes  \- Reputation multiplier: reputation\_score / 100 (capped at 2x)  \- Max earning per post: 10 TC- Anti-spam checks: max 5 earning-eligible posts per day per user- Creates transaction records with type 'earning'5. ANTI-SPAM- Rate limit: max 10 posts per day per user (DB constraint or Edge Function check)- New posts from users with reputation \< 5 are not earning\_eligible- Flag system: 3 flags from distinct users \= auto-hide post- Flagged posts reviewed by moderators- Moderator role: can unhide posts, ban users temporarily6. NOTIFICATIONS- notifications table: id, user\_id, type, title, body, read, created\_at- Supabase Realtime subscription for new notifications- Notification bell in header with unread count- Triggers: someone liked your post, someone tipped you, someone commented, your post earned TC, tax deductedDO NOT build: marketplace, task board, service listings, fiat gateway. Those are Phase 3\.

## **Phase 3 Prompt: Marketplace**

***Send this ONLY after Phase 2 is complete and tested:***

Continue building TimeCoin. Phase 1 (wallet) and Phase 2 (social) are complete.PHASE 3 SCOPE \- Marketplace:1. TASK BOARD- tasks table: id, poster\_id, worker\_id (nullable), title, description, bounty\_amount, status (open/claimed/submitted/approved/disputed/cancelled), escrow\_tx\_id, created\_at, updated\_at- Task lifecycle: Post (TC goes to escrow) \-\> Claim \-\> Submit work \-\> Approve (TC released to worker) OR Dispute- Escrow RPC function: lock\_task\_escrow(task\_id, amount) \- debits poster, credits system escrow wallet- Release RPC function: release\_task\_escrow(task\_id) \- debits escrow, credits worker- Cancel RPC function: cancel\_task\_escrow(task\_id) \- returns TC to poster2. SERVICE LISTINGS- services table: id, provider\_id, title, description, category, price\_tc, price\_type (fixed/hourly), rating\_avg, review\_count, is\_active, created\_at- service\_reviews table: id, service\_id, reviewer\_id, rating (1-5), review\_text, created\_at- Browse services by category, search, rating3. SEARCH & DISCOVERY- Full-text search using PostgreSQL tsvector on: posts.content\_text, tasks.title \+ description, services.title \+ description- Category/tag system for tasks and services- Trending content (highest engagement in last 24h)- Filter by: type (task/service/post), price range, status, category4. DISPUTE RESOLUTION- disputes table: id, task\_id, initiated\_by, reason, status (open/resolved), resolution, jury\_votes (jsonb), created\_at- When disputed: 3 random users with reputation \> 50 are selected as jury- Jury members vote: approve worker / return to poster / split- Majority wins. Jury members earn 2 TC for participation.5. UI PAGES- /marketplace \- tabs: Tasks / Services / My Listings- /marketplace/tasks/new \- create task form with TC bounty- /marketplace/tasks/:id \- task detail with claim/submit/approve/dispute actions- /marketplace/services/new \- create service listing- /marketplace/services/:id \- service detail with reviews- /search \- unified search across all content typesDO NOT build: fiat gateway, analytics dashboard, mobile PWA. Those are Phase 4\.

# **11\. Success Criteria for Prototype**

The centralized prototype succeeds if the following conditions are met after 4 weeks of beta testing with 50+ users:

* TC Velocity \> 0: Users are actually transacting, not just holding. Measure: average transactions per active user per week \> 3\.

* Earning/Spending Ratio: At least 60% of earned TC is spent within 2 weeks. If TC accumulates and sits, the economy is stalling.

* Content Quality: Less than 10% of posts flagged as spam. Average engagement per post is growing week-over-week.

* Task Completion: At least 50% of posted tasks are claimed. At least 70% of claimed tasks are completed successfully.

* User Retention: Week 2 retention \> 40%. If users try it and leave, the value proposition is not working.

* Gini Coefficient \< 0.4: TC distribution should be relatively equal. If it concentrates despite the tax and cap, the economic model needs adjustment.

## **When to Proceed to Decentralization**

*Do NOT begin DAG implementation until: the centralized prototype has been running for at least 3 months with real users, the economic parameters have been tuned through at least 5 iteration cycles, there is clear evidence that people value TC enough to do real work for it, and you have a team of at least 2–3 developers (DAG consensus is not a solo project).*

# **12\. Future: DAG Decentralization Notes**

For reference only — do not build this during the prototype phase.

* Ledger Layer: Replace Supabase transactions table with a DAG-based ledger (research IOTA Tangle, Nano block-lattice, or Hedera Hashgraph for inspiration).

* Consensus: Contribution-weighted voting — users with higher reputation have more consensus weight (not stake-weighted, which would contradict anti-hoarding principles).

* Identity: Decentralized identity (DID) to prevent Sybil attacks without centralized auth.

* Smart Contracts: Tax calculation, escrow, and earning engine as on-chain logic.

* Migration: Run centralized and decentralized systems in parallel during migration. Verify ledger consistency before cutover.