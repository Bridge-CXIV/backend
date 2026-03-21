# Transparent Charity Tracker — Project Architecture
> Powered by Hedera Hashgraph | Testnet Phase

---

## Project Idea

Build a Transparent Charity Tracker powered by Hedera. Every donation and expense is logged immutably on-chain using Hedera Consensus Service. Donors can see a real-time dashboard showing how funds are allocated, verified charities and grant seekers can receive funds transparently, and admins ensure legitimacy through multi-signature verification.

---

## Hedera Products Used (and Why)

Maximising Hedera-native tooling is critical for hackathon scoring. Below are every Hedera product integrated into this project and what role each plays.

### 1. Hedera Consensus Service (HCS)
**What it does:** Provides a decentralised, tamper-proof message log — like an immutable audit trail.

**How it's used here:**
- Log every verified request (charity or grant) as an HCS topic message
- Log every donation event with donor address, amount, and timestamp
- Log every expense update submitted by a request owner
- Log every admin verification action (who signed, when)
- Log impact updates posted by charities/grant seekers

Each request gets its own **dedicated HCS topic**, so donors can subscribe to or query the specific topic for a cause they care about.

---

### 2. Hedera Token Service (HTS)
**What it does:** Native token creation and management on Hedera — faster and cheaper than EVM token contracts.

**How it's used here:**
- Mint an **NFT donation receipt** for every donor upon successful donation. The NFT metadata contains: donor address, amount donated, cause name, timestamp, and HCS topic ID of the cause. This gives donors a verifiable, on-chain proof of contribution.
- Optionally, mint a **platform fungible token** (e.g. `HOPE`) as a governance/reward token for future enhancements.

**Why this matters for the hackathon:** HTS is a flagship Hedera product. Using it for NFT receipts is a creative, practical use case that directly demonstrates native Hedera capability beyond EVM contracts.

---

### 3. Hedera Smart Contract Service (HSCS)
**What it does:** EVM-compatible smart contract execution on Hedera.

**How it's used here:**
- The core donation contract lives here — handling fund receipt, 3% fee deduction, and fund release
- Interacts with HTS to trigger NFT receipt minting on donation
- Holds funds in escrow until the deadline or goal is met
- Automatically releases funds to the requester's Hedera wallet

**Note:** HSCS contracts are Solidity-compatible, so your existing Foundry workflow applies.

---

### 4. Hedera File Service (HFS)
**What it does:** Stores arbitrary files or metadata on the Hedera network with an immutable file ID.

**How it's used here:**
- Store request metadata on-chain: descriptions, business plans, purpose statements, and image hashes
- The HFS File ID is then referenced in the HCS topic message, creating a fully on-chain audit trail without bloating HCS messages with large payloads
- For grant requests, proof-of-business documents are uploaded to HFS, and the file ID is the on-chain reference

**Why this matters for the hackathon:** Most projects only use HCS + contracts. Using HFS for document storage shows deep Hedera integration.

---

### 5. Hedera Mirror Node REST API
**What it does:** Provides a queryable, indexed view of all Hedera network activity — transactions, HCS messages, token transfers, and more.

**How it's used here:**
- The backend polls the Mirror Node to index HCS messages for each cause into the database
- The real-time dashboard reads indexed data served from the backend (which was sourced from Mirror Node)
- Token transfer history for each cause is queryable via Mirror Node to show donation flows

**Endpoints used:**
- `GET /api/v1/topics/{topicId}/messages` — fetch all HCS messages for a cause
- `GET /api/v1/tokens/{tokenId}/nfts` — verify donor NFT receipts
- `GET /api/v1/contracts/results` — monitor smart contract events

---

### 6. HashConnect (Wallet Integration)
**What it does:** WalletConnect equivalent for Hedera — connects Hashpack and other native Hedera wallets to web apps.

**How it's used here:**
- Donors who already have a Hedera wallet (e.g. Hashpack) connect natively via HashConnect
- This is the "connect wallet" path in the dual-auth system

---

## Account Abstraction — Magic.link

Users who prefer not to manage a Web3 wallet can sign in with Google. Magic.link handles the entire account abstraction flow.

### How It Works

```
User clicks "Sign in with Google"
        ↓
Magic.link handles Google OAuth
        ↓
Magic derives a keypair using threshold cryptography (no single party holds full key)
        ↓
Backend receives Magic's DID token, verifies it
        ↓
Backend calls AccountCreateTransaction via Hedera JS SDK
  (operator account pays the creation fee in HBAR)
        ↓
Backend stores: { magicUserId → hederaAccountId }
        ↓
User now has a Hedera account — no wallet setup required
```

### Key Properties
- Magic.link has **native Hedera support** — the Hedera provider is available out of the box
- No private key custody on your backend — Magic uses threshold cryptography
- The user's keypair lives in Magic's distributed key management system
- Signing transactions on behalf of the user goes through Magic's SDK

---

## Full System Architecture

### Dual Entry Points

```
┌─────────────────────────────────────────────────────────────┐
│                        USER ENTRY                            │
│                                                              │
│   [Sign in with Google]          [Connect Wallet]           │
│          │                              │                    │
│          ▼                              ▼                    │
│   Magic.link (OAuth)           HashConnect (Hashpack)        │
│          │                              │                    │
│          ▼                              │                    │
│   Backend creates                       │                    │
│   Hedera Account                        │                    │
│          │                              │                    │
│          └──────────────┬───────────────┘                    │
│                         ▼                                    │
│              User has a Hedera Account ID                    │
└─────────────────────────────────────────────────────────────┘
```

### Request Lifecycle

```
1. Requester submits request (charity or grant)
          │
          ▼
2. Backend uploads metadata/documents → Hedera File Service (HFS)
          │
          ▼
3. Backend stores request in database (pending verification)
          │
          ▼
4. Admins review → Multi-signature verification
   (minimum threshold of admin signatures required)
          │
          ▼
5. Once verified → HCS topic created for this request
   Verification event logged as first HCS message
          │
          ▼
6. Request goes live on dashboard
          │
          ▼
7. Donor makes donation via smart contract (HSCS)
   ├── Contract deducts 3% operational fee
   ├── Remaining funds held in escrow
   └── HTS mints NFT donation receipt → donor's wallet
          │
          ▼
8. Donation event logged to request's HCS topic
          │
          ▼
9. When goal is met OR timeline expires:
   Smart contract releases funds to requester's Hedera wallet
          │
          ▼
10. Requester posts expense/impact updates
    Each update logged to HCS topic
```

### High-Level Component Map

```
┌────────────────────────────────────────────────────────────────────┐
│  FRONTEND (React)                                                   │
│  Dashboard · Submit Request · Admin Panel · Donation UI             │
└────────────────┬───────────────────────────────────────────────────┘
                 │ REST API
┌────────────────▼───────────────────────────────────────────────────┐
│  BACKEND (Node.js / Express)                                        │
│  Auth · Request Management · Admin Multi-Sig · Mirror Node Indexer  │
└─────┬─────────┬──────────┬──────────┬──────────┬───────────────────┘
      │         │          │          │          │
      ▼         ▼          ▼          ▼          ▼
  Magic.link  Hedera    Hedera    Hedera     Mirror
  (Auth &     HCS       HFS       HSCS       Node API
  Acct        (Logging) (Docs)    (Contract) (Dashboard
  Creation)                                  Indexing)
                          │
              ┌───────────▼────────────┐
              │  Database (PostgreSQL)  │
              │  Users · Requests ·     │
              │  Donations · HCS Index  │
              └────────────────────────┘
```

---

## Request Types

### Charity Request
| Field | Required | Notes |
|---|---|---|
| Title | Yes | Display name of the cause |
| Description | Yes | What the charity does |
| Purpose | Yes | What this specific funding is for |
| Amount | Yes | Target funding goal |
| Timeline | Yes | Deadline for the campaign |
| Wallet / Hedera Account | Yes | Auto-assigned if Google auth |
| Image | No | Uploaded → IPFS/Cloudinary, hash stored in HFS |

### Grant Request
| Field | Required | Notes |
|---|---|---|
| Title | Yes | Project name |
| Description | Yes | Overview of the project |
| Purpose | Yes | Specific use of grant funds |
| Business Type | Yes | Type of business or organisation |
| Business Plan | Yes | Document uploaded to HFS |
| Proof of Business | Yes | Document uploaded to HFS |
| Amount | Yes | Grant amount requested |
| Timeline | Yes | Project timeline |
| Wallet / Hedera Account | Yes | Auto-assigned if Google auth |
| Images | No | Optional supporting visuals |

---

## Admin Verification (Multi-Signature)

- A configurable threshold of admins (e.g. 2-of-3) must approve a request before it goes live
- Each admin signs a verification message with their wallet
- Backend tracks signatures in the database
- When threshold is reached, backend submits a verification HCS message and activates the request
- All admin actions are logged on HCS for full accountability

---

## Smart Contract Behaviour

- Accepts HBAR donations for a specific request ID
- Deducts **3% operational fee** from each donation, held separately
- Holds remaining funds in escrow
- Releases escrowed funds to the requester's Hedera wallet when:
  - The funding goal is fully met, OR
  - The campaign timeline expires (partial release)
- Calls HTS to mint an NFT donation receipt per donation
- Emits events consumed by the Mirror Node indexer

---

## Walkthrough

1. A charity or grant seeker submits their request with all required details. Supporting documents are uploaded to Hedera File Service.
2. Admins review the submission. A multi-signature threshold must be met before the request is approved. All admin actions are recorded.
3. Once verified, a dedicated HCS topic is created for the request, and the verification event is logged as the first message on that topic.
4. The request appears on the live dashboard. Donors can browse all active requests and view their full audit trail via HCS.
5. A donor makes a donation through the smart contract. The contract deducts the 3% operational fee, holds the rest in escrow, and triggers an HTS NFT receipt mint to the donor's wallet. The donation is also logged to the request's HCS topic.
6. When the goal is reached or the timeline expires, the smart contract automatically releases funds to the requester's Hedera wallet.
7. The requester posts expense updates and impact reports. Each update is logged to the HCS topic, giving donors an ongoing, immutable record of how their funds are being used.

---

## Technologies Used

| Category | Technology | Purpose |
|---|---|---|
| Ledger | Hedera Hashgraph | Decentralised, transparent, immutable records |
| Consensus Logging | Hedera Consensus Service (HCS) | Immutable audit log for all events |
| Token Service | Hedera Token Service (HTS) | NFT donation receipts |
| Smart Contracts | Hedera Smart Contract Service (HSCS) | Donation logic, fee deduction, fund release |
| File Storage | Hedera File Service (HFS) | On-chain document/metadata storage |
| Data Indexing | Hedera Mirror Node REST API | Power the real-time dashboard |
| Wallet (native) | HashConnect | Hashpack and native Hedera wallet users |
| Account Abstraction | Magic.link (Hedera provider) | Google Sign-In → auto Hedera account |
| Smart Contract Dev | Solidity + Foundry | Contract development and testing |
| Frontend | React | User interface |
| Backend | Node.js / Express | Server-side logic, Hedera SDK interactions |
| Database | PostgreSQL | Off-chain storage: users, requests, indexed HCS data |
| Document Storage | IPFS / Cloudinary | Images and supporting files (hash referenced in HFS) |

---

## File Structure

### Solidity (Foundry)

```
contracts/
├── CharityTracker.sol              # Core contract: donations, escrow, fee, fund release
├── interfaces/
│   └── ICharityTracker.sol         # Interface for the core contract
└── libraries/
    └── FeeLib.sol                  # Fee calculation helpers

test/
└── CharityTracker.t.sol            # Foundry test suite

script/
└── Deploy.s.sol                    # Deployment script

foundry.toml                        # Foundry config
.env                                # PRIVATE_KEY, RPC_URL (Hedera testnet)
remappings.txt
```

---

### Backend (Node.js / Express)

```
src/
├── index.js                        # Entry point, Express app setup

├── config/
│   ├── hedera.js                   # Hedera JS SDK client setup (operator account)
│   ├── magic.js                    # Magic Admin SDK setup
│   └── db.js                       # PostgreSQL connection

├── routes/
│   ├── auth.js                     # POST /auth/google, POST /auth/verify
│   ├── requests.js                 # CRUD for charity and grant requests
│   ├── donations.js                # Donation history and lookup
│   ├── admin.js                    # Admin verification endpoints
│   └── dashboard.js                # Aggregated dashboard data

├── controllers/
│   ├── authController.js
│   ├── requestController.js
│   ├── donationController.js
│   └── adminController.js

├── services/
│   ├── hcsService.js               # Create topics, submit HCS messages
│   ├── htsService.js               # Mint NFT donation receipts via HTS
│   ├── hfsService.js               # Upload metadata/documents to HFS
│   ├── mirrorNodeService.js        # Query Mirror Node, parse events
│   ├── magicService.js             # Verify Magic DID tokens, provision accounts
│   ├── accountService.js           # AccountCreateTransaction for new users
│   ├── storageService.js           # Upload images to IPFS/Cloudinary
│   └── multiSigService.js          # Track admin signatures, trigger verification

├── middleware/
│   ├── auth.js                     # Verify Magic DID or wallet signature
│   └── adminGuard.js               # Restrict admin-only routes

├── models/
│   ├── User.js                     # { id, magicUserId, hederaAccountId, role }
│   ├── Request.js                  # { id, type, status, hcsTopicId, hfsFileId, ... }
│   └── Donation.js                 # { id, requestId, donorId, amount, nftId, ... }

└── jobs/
    └── mirrorNodePoller.js         # Background job: poll Mirror Node, index HCS messages

.env                                # HEDERA_OPERATOR_ID, HEDERA_OPERATOR_KEY,
                                    # MAGIC_SECRET_KEY, DATABASE_URL, etc.
package.json
```

---

### Frontend (React)

```
src/
├── pages/
│   ├── Home.jsx                    # Landing page
│   ├── Dashboard.jsx               # Real-time donation dashboard
│   ├── SubmitRequest.jsx           # Charity / grant request form
│   ├── RequestDetail.jsx           # Individual request + HCS audit log
│   └── Admin.jsx                   # Admin verification panel

├── components/
│   ├── Navbar.jsx
│   ├── RequestCard.jsx             # Preview card for each cause
│   ├── DonationModal.jsx           # Donation flow UI
│   ├── AuditLog.jsx                # Renders HCS message history
│   ├── NFTReceiptBadge.jsx         # Shows donor's NFT receipt
│   └── AdminSignaturePanel.jsx     # Multi-sig progress display

├── hooks/
│   ├── useAuth.js                  # Auth state (Magic or HashConnect)
│   ├── useMagic.js                 # Magic.link login/logout
│   ├── useHashConnect.js           # Native wallet connection
│   └── useDashboard.js             # Fetch and poll dashboard data

├── services/
│   ├── api.js                      # All calls to your backend REST API
│   └── hashconnect.js              # HashConnect session management

├── context/
│   └── AuthContext.jsx             # Global auth state provider

└── utils/
    └── formatters.js               # HBAR formatting, date helpers, address truncation

.env                                # REACT_APP_BACKEND_URL, REACT_APP_MAGIC_PUBLISHABLE_KEY
package.json
```

---

## Future Enhancements

1. Implement a reputation system for charities and grant seekers based on donor feedback and successful project completion.
2. Integrate with other blockchain platforms to expand the reach and accessibility of the tracker.
3. Mechanism to set up quarterly or yearly reviews on how the funds are being utilised by the charity or grant seekers. This review will be compulsory and will be embedded in the terms and conditions of the protocol.