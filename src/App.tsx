import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import {
  Activity,
  AlertTriangle,
  Award,
  Bell,
  Box,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Cpu,
  CreditCard,
  Database,
  Download,
  Eye,
  Factory,
  FileCheck2,
  FileText,
  Filter,
  Flame,
  Gavel,
  Globe,
  Headset,
  Layers,
  Leaf,
  Lock,
  Menu,
  MessageSquare,
  Package,
  PhoneCall,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  Send,
  ShieldCheck,
  Sliders,
  TrendingDown,
  TrendingUp,
  Truck,
  UserCheck,
  Video,
  Webhook,
  X,
} from 'lucide-react';

export type TabId =
  | 'workflow'
  | 'marketplace'
  | 'tenders'
  | 'dealroom'
  | 'qcesg'
  | 'business'
  | 'blueprint';

export type SceneMode = 'granular' | 'logistics' | 'network';
export type PaymentTerm = 'SPOT_ESCROW' | 'NET_30' | 'NET_60';
export type DataViewState = 'ready' | 'loading' | 'empty' | 'error';

export interface CommodityTicker {
  code: string;
  label: string;
  priceIdr: number;
  unit: string;
  deltaPct: number;
  linkedMaterialId?: string;
}

export interface RoleAccount {
  id: string;
  roleCode: 'PRODUCER' | 'BUYER' | 'AUDITOR' | 'HYBRID';
  roleLabel: string;
  personName: string;
  companyName: string;
  city: string;
  nib: string;
  klhkStatus: string;
  creditLimitIdr: number;
  escrowBalanceIdr: number;
  saasPlan: 'STARTER' | 'GROWTH_PRO' | 'ENTERPRISE';
  ownerSummary: string;
}

export interface MaterialItem {
  id: string;
  code: string;
  name: string;
  shortName: string;
  matchPct: number;
  pricePerTon: number;
  availableTons: number;
  contractMoisturePct: number;
  keyMetricLabel: string;
  keyMetricValue: string;
  casNumber: string;
  ashContentPct: number;
  bulkDensity: string;
  tclpStatus: string;
  co2FactorPerTon: number;
  supplierName: string;
  originCity: string;
  coreHex: number;
  particleHex: number;
  coaDocName: string;
}

export interface TenderItem {
  id: string;
  code: string;
  buyerCompany: string;
  location: string;
  materialNeeded: string;
  volumeTons: number;
  specSummary: string;
  maxMoisturePct: number;
  lowestBidIdr: number;
  bidCount: number;
  secondsLeft: number;
  leadingBidder: string;
}

export interface ChatAttachment {
  fileName: string;
  labIssuer: string;
  hash: string;
  summary: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  company: string;
  roleTag: string;
  timestamp: string;
  text: string;
  attachment?: ChatAttachment;
  isCounterOffer?: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorNib: string;
  company: string;
  eventAction: string;
  sha256Hash: string;
  status: 'VERIFIED' | 'LOCKED' | 'SYNCED';
}

export interface ErpConnector {
  id: string;
  name: string;
  protocol: string;
  endpoint: string;
  connected: boolean;
  lastSync: string;
  testing?: boolean;
  lastError?: string | null;
}

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  time: string;
  unread: boolean;
  targetTab: TabId;
}

const formatRupiah = (value: number): string =>
  `Rp ${Math.round(value).toLocaleString('id-ID')}`;

const formatDecimalId = (value: number, fractionDigits = 2): string =>
  value.toLocaleString('id-ID', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

// Deterministic 64-character hex digest for audit chain entries and Scope-3 certificates.
const computeDeterministicHash = (input: string): string => {
  const seeds = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    for (let s = 0; s < seeds.length; s++) {
      seeds[s] = Math.imul(seeds[s] ^ (ch + s * 31), 0x01000193) >>> 0;
      seeds[s] = ((seeds[s] << 13) | (seeds[s] >>> 19)) >>> 0;
    }
  }
  return seeds.map((n) => n.toString(16).padStart(8, '0')).join('');
};

const formatCountdown = (seconds: number): string => {
  const clamped = Math.max(0, seconds);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const INITIAL_TICKERS: CommodityTicker[] = [
  {
    code: 'PKS-GRD-A',
    label: 'Palm Kernel Shell',
    priceIdr: 1350000,
    unit: '/t',
    deltaPct: 2.4,
    linkedMaterialId: 'pks',
  },
  {
    code: 'RHA-SIO2-92',
    label: 'Amorphous Rice Husk Silica',
    priceIdr: 890000,
    unit: '/t',
    deltaPct: 4.1,
    linkedMaterialId: 'rha',
  },
  {
    code: 'FA-CLS-F',
    label: 'Fly Ash Class F - TCLP Pass',
    priceIdr: 320000,
    unit: '/t',
    deltaPct: -0.8,
    linkedMaterialId: 'flyash',
  },
  {
    code: 'SLG-EAF-01',
    label: 'Steel EAF Slag Aggregate',
    priceIdr: 245000,
    unit: '/t',
    deltaPct: 1.5,
  },
  {
    code: 'GYP-FGD-95',
    label: 'Synthetic FGD Gypsum',
    priceIdr: 410000,
    unit: '/t',
    deltaPct: 1.9,
  },
  {
    code: 'IDX-CRBN-S3',
    label: 'Industrial Scope-3 Offset',
    priceIdr: 98500,
    unit: '/tCO2e',
    deltaPct: 5.6,
  },
];

const PRESET_ACCOUNTS: RoleAccount[] = [
  {
    id: 'acc-generator',
    roleCode: 'PRODUCER',
    roleLabel: 'Generator (Penghasil Limbah)',
    personName: 'Ir. Hendra Wijaya, M.T.',
    companyName: 'PT Agro Sawit Lestari Tbk',
    city: 'Gresik',
    nib: '9120300492817',
    klhkStatus: 'SIMPEL-KLHK Verified',
    creditLimitIdr: 1500000000,
    escrowBalanceIdr: 840000000,
    saasPlan: 'GROWTH_PRO',
    ownerSummary:
      'Ir. Hendra Wijaya, M.T. — PT Agro Sawit Lestari Tbk (Gresik, NIB: 9120300492817, SIMPEL-KLHK Verified, Credit Limit: Rp 1,5 Miliar)',
  },
  {
    id: 'acc-buyer',
    roleCode: 'BUYER',
    roleLabel: 'Buyer (Pabrik Pemanfaat)',
    personName: 'Sarah Kusuma, MBA, CPSM',
    companyName: 'PT Energi Biomassa Nusantara',
    city: 'Cikarang',
    nib: '8190200119283',
    klhkStatus: 'Co-Firing Verified',
    creditLimitIdr: 3500000000,
    escrowBalanceIdr: 1425000000,
    saasPlan: 'ENTERPRISE',
    ownerSummary:
      'Sarah Kusuma, MBA, CPSM — PT Energi Biomassa Nusantara (Cikarang, NIB: 8190200119283, Co-Firing Verified, Credit Limit: Rp 3,5 Miliar)',
  },
  {
    id: 'acc-auditor',
    roleCode: 'AUDITOR',
    roleLabel: 'Auditor ESG / Regulator KLHK',
    personName: 'Dr. Bambang Sutrisno',
    companyName: 'Otoritas Audit Sertifikasi GRI 306 & ISO 14064',
    city: 'Jakarta',
    nib: '1002003004005',
    klhkStatus: 'GRI 306 & ISO 14064 Inspector',
    creditLimitIdr: 0,
    escrowBalanceIdr: 0,
    saasPlan: 'ENTERPRISE',
    ownerSummary:
      'Dr. Bambang Sutrisno — Otoritas Audit Sertifikasi GRI 306 & ISO 14064 (Jakarta, Read-Only Inspector)',
  },
];

const MATERIALS: MaterialItem[] = [
  {
    id: 'pks',
    code: 'PKS-GRD-A',
    name: 'Cangkang Kelapa Sawit (Palm Kernel Shell - Grade A)',
    shortName: 'Palm Kernel Shell Grade A',
    matchPct: 98.4,
    pricePerTon: 1350000,
    availableTons: 450,
    contractMoisturePct: 11.2,
    keyMetricLabel: 'Nilai Kalori Bersih (NCV)',
    keyMetricValue: '4,450 kcal/kg',
    casNumber: '68956-68-3',
    ashContentPct: 2.35,
    bulkDensity: '0.62 t/m³',
    tclpStatus: 'Non-B3 Biomassa Murni (KLHK Verified)',
    co2FactorPerTon: 1.42,
    supplierName: 'PT Agro Sawit Lestari Tbk',
    originCity: 'Gresik, Jawa Timur',
    coreHex: 0x10b981,
    particleHex: 0x34d399,
    coaDocName: 'COA_Sucofindo_PKS_Oct2026.pdf',
  },
  {
    id: 'rha',
    code: 'RHA-SIO2-92',
    name: 'Silika Sekam Padi Amorf (Rice Husk Ash - High Silica 92%)',
    shortName: 'Rice Husk Ash SiO2 92%',
    matchPct: 95.1,
    pricePerTon: 890000,
    availableTons: 180,
    contractMoisturePct: 3.8,
    keyMetricLabel: 'Kemurnian Silika Amorf',
    keyMetricValue: '92.6% SiO2',
    casNumber: '7631-86-9',
    ashContentPct: 4.1,
    bulkDensity: '0.38 t/m³',
    tclpStatus: 'Pozzolan & Insulator Grade (SGS Verified)',
    co2FactorPerTon: 0.94,
    supplierName: 'PT Padi Silika Karawang',
    originCity: 'Karawang, Jawa Barat',
    coreHex: 0x06b6d4,
    particleHex: 0x22d3ee,
    coaDocName: 'COA_SGS_RHA_Silica92_Oct2026.pdf',
  },
  {
    id: 'flyash',
    code: 'FA-CLS-F',
    name: 'Fly Ash Batubara Kelas F (TCLP Pass)',
    shortName: 'Fly Ash Kelas F (TCLP Pass)',
    matchPct: 92.7,
    pricePerTon: 320000,
    availableTons: 1200,
    contractMoisturePct: 0.9,
    keyMetricLabel: 'Oksida Pozzolan Utama',
    keyMetricValue: 'SiO2+Al2O3+Fe2O3 > 78%',
    casNumber: '68131-74-8',
    ashContentPct: 86.4,
    bulkDensity: '1.12 t/m³',
    tclpStatus: 'Nontoksik Limbah Terdaftar PP 22/2021 (TCLP Pass)',
    co2FactorPerTon: 0.78,
    supplierName: 'PT Pembangkit Jawa Sirkular',
    originCity: 'Suralaya, Banten',
    coreHex: 0xf59e0b,
    particleHex: 0x38bdf8,
    coaDocName: 'COA_Sucofindo_FlyAshF_TCLP_Oct2026.pdf',
  },
];

const INITIAL_TENDERS: TenderItem[] = [
  {
    id: 'rfq-01',
    code: 'RFQ-SHN-2026-104',
    buyerCompany: 'PT Semen Hijau Nusantara',
    location: 'Tuban, Jawa Timur',
    materialNeeded: 'Fly Ash Batubara Kelas F (Substitusi Klinker Semen)',
    volumeTons: 1500,
    specSummary: 'SiO2+Al2O3+Fe2O3 >= 75%, LOI < 4.0%, TCLP Pass PP 22/2021',
    maxMoisturePct: 1.5,
    lowestBidIdr: 318000,
    bidCount: 7,
    secondsLeft: 14820,
    leadingBidder: 'PT Pembangkit Jawa Sirkular',
  },
  {
    id: 'rfq-02',
    code: 'RFQ-PLB-2026-219',
    buyerCompany: 'PT Pembangkit Listrik Biomassa',
    location: 'Cikarang, Jawa Barat',
    materialNeeded: 'Cangkang Kelapa Sawit (PKS Grade A Co-Firing Boiler)',
    volumeTons: 600,
    specSummary: 'NCV >= 4.400 kcal/kg, Ash <= 3.0%, Kontrak Rutin Net-60',
    maxMoisturePct: 12.0,
    lowestBidIdr: 1335000,
    bidCount: 5,
    secondsLeft: 8935,
    leadingBidder: 'PT Agro Sawit Lestari Tbk',
  },
  {
    id: 'rfq-03',
    code: 'RFQ-BSC-2026-087',
    buyerCompany: 'PT Baja Sirkular Cilegon',
    location: 'Cilegon, Banten',
    materialNeeded: 'Silika Sekam Padi Amorf (Insulator Tundish Pengecoran Baja)',
    volumeTons: 300,
    specSummary: 'SiO2 Amorf >= 90%, Ukuran Granul < 2.0 mm, Kemasan FIBC 1.5t',
    maxMoisturePct: 4.5,
    lowestBidIdr: 878000,
    bidCount: 4,
    secondsLeft: 21450,
    leadingBidder: 'PT Padi Silika Karawang',
  },
];

const NAV_TABS: { id: TabId; label: string; shortDesc: string }[] = [
  { id: 'workflow', label: '1. Workflow', shortDesc: 'Simulator End-to-End 7 Tahap' },
  { id: 'marketplace', label: '2. 3D & Bursa', shortDesc: 'Katalog AI, 3D & Kontrak' },
  { id: 'tenders', label: '3. Tender & Kredit', shortDesc: 'Lelang RFQ & Trade Finance' },
  { id: 'dealroom', label: '4. Deal Room', shortDesc: 'Chat B2B, Video & Sampel 15kg' },
  { id: 'qcesg', label: '5. QC & ESG', shortDesc: 'Moisture QC & Sertifikat Scope-3' },
  { id: 'business', label: '6. Bisnis & ERP', shortDesc: 'Unit Economics, SaaS & SAP' },
  { id: 'blueprint', label: '7. Master .MD', shortDesc: 'Dokumen & Skema SQL PostGIS' },
];

const WORKFLOW_STEPS = [
  {
    step: 1,
    title: 'Login Multi-Role, SSO & Verifikasi KYB (NIB + KLHK)',
    department: 'Legal, Compliance & Treasury',
    summary:
      'Otentikasi korporat berbasis 13-digit NIB OSS dan sinkronisasi langsung dengan sistem SIMPEL-KLHK untuk memastikan pengirim maupun penerima memiliki izin pengelolaan atau pemanfaatan material sekunder yang sah.',
    deliverable: 'Aktivasi akun korporat + Plafon Kredit Net-60 otomatis hingga Rp 3,5 Miliar.',
    ctaLabel: 'Buka Modal SSO & KYB Multi-Role',
  },
  {
    step: 2,
    title: 'AI Lab Scanner (Ekstraksi PDF COA/MSDS Sucofindo)',
    department: 'Laboratorium QC & Data Science',
    summary:
      'Mesin OCR kimia mengekstrak parameter nilai kalor, kadar air (moisture), kadar abu, nomor CAS, dan uji TCLP dari sertifikat laboratorium Sucofindo/SGS menjadi vektor 768-dimensi (pgvector) untuk pencocokan otomatis.',
    deliverable: 'Skor kecocokan spesifikasi kimia 98.4% terhadap kebutuhan tungku/pabrik pembeli.',
    ctaLabel: 'Jalankan Simulasi Ekstraksi PDF COA (0% - 100%)',
  },
  {
    step: 3,
    title: '3D Digital Twin & Thermal Inspection',
    department: 'Process Engineering & Material QC',
    summary:
      'Inspeksi visual berbasis WebGL Three.js untuk memutar granulasi partikel 360 derajat, mengecek susunan 16 FIBC Jumbo Bag dalam kontainer 20ft, serta mengaktifkan mode Thermal X-Ray guna mendeteksi kantong kelembapan tersembunyi.',
    deliverable: 'Validasi fisik digital pra-pengiriman sebelum armada truk diberangkatkan.',
    ctaLabel: 'Aktifkan Thermal X-Ray & Exploded View 3D',
  },
  {
    step: 4,
    title: 'Lelang Tender RFQ & B2B Trade Finance (Net-30/60)',
    department: 'VP Procurement & Corporate Finance',
    summary:
      'Pabrik pemanfaat mempublikasikan tender pengadaan terbuka (Reverse Auction) mirip SAP Ariba. Pembeli menikmati tempo pembayaran Net-60, sedangkan penjual dapat mencairkan tagihan pada hari H (T+0 Early Factoring).',
    deliverable: 'Penghematan biaya bahan baku 6% - 14% dan likuiditas kas instan bagi pemasok.',
    ctaLabel: 'Buka Papan Tender RFQ & Plafon Net-60',
  },
  {
    step: 5,
    title: 'Cara Menghubungi: Deal Room, Video Call Gudang & Sampel 15kg',
    department: 'Sourcing Specialist & Gudang Bahan Baku',
    summary:
      'Empat jalur komunikasi resmi teraudit: inspeksi stok gudang via WebRTC, pemesanan sampel fisik 15 kg bersegel QR untuk uji lab internal, jembatan WhatsApp Enterprise API, dan Dedicated Account Manager untuk kontrak >= 200 Ton.',
    deliverable: 'Transparansi stok riil dan rekam jejak negosiasi terenkripsi.',
    ctaLabel: 'Masuk ke Deal Room & Kanal Inspeksi',
  },
  {
    step: 6,
    title: 'Dynamic Moisture QC & 3-Way Invoice Matching',
    department: 'Jembatan Timbang (Weighbridge) & AP Accounting',
    summary:
      'Jika kadar air aktual saat truk ditimbang melebihi batas kontrak, rumus basis kering (dry-basis) menghitung potongan penalti otomatis dan mengembalikan selisih dana ke pembeli sebelum mencairkan Smart Escrow.',
    deliverable: 'Rekonsiliasi 3 arah otomatis: PO, Tiket Jembatan Timbang IoT, dan e-Faktur PPN 11%.',
    ctaLabel: 'Uji Kalkulator Penalti Moisture & 3-Way Match',
  },
  {
    step: 7,
    title: 'ERP SAP Webhook, SaaS Tier & Sertifikat Karbon ESG',
    department: 'IT Enterprise, Sustainability & CFO Office',
    summary:
      'Setiap transaksi menyimulasikan sinkronisasi Goods Receipt ke SAP S/4HANA MM, mencatat jejak hash deterministik prototipe, dan menerbitkan draf Sertifikat Reduksi Emisi Scope-3 berbasis rumus ISO 14064-1 & GRI 306.',
    deliverable: 'Audit trail siap periksa regulator dan monetisasi unit ekonomi B2B berkelanjutan.',
    ctaLabel: 'Buka Simulator Revenue CBO & Webhook SAP',
  },
];

const MASTER_BLUEPRINT_MD = `# SYMBIOFLOW ENTERPRISE v4.0 - MASTER ARCHITECTURE & PRODUCTION BLUEPRINT

## 1. Ringkasan Eksekutif Arsitektur
SymbioFlow Enterprise v4.0 menyatukan empat pilar infrastruktur industri sirkular B2B:
1. **AI Chemical Vector Marketplace (\`pgvector\` 768-dim):** Mencocokkan parameter laboratorium COA/MSDS (Sucofindo/SGS) antara pabrik penghasil residu dan pabrik pemanfaat.
2. **3D WebGL Digital Twin Inspector (\`Three.js\`):** Visualisasi granulasi kimia, tata letak muatan 16 FIBC Jumbo Bag (@ 1,5 Ton) pada kontainer 20ft, serta topologi simbiosis kawasan industri dengan mode *Thermal X-Ray* dan *Exploded View* (\`1.85x\`).
3. **Smart Escrow & B2B Trade Finance (Net-30 / Net-60 + Early Factoring T+0):** Penjaminan dana berbasis pencocokan 3 arah (*3-Way Matching*: PO, Tiket Jembatan Timbang IoT, e-Faktur DJP PPN 11%).
4. **Automated Scope-3 Carbon Ledger (ISO 14064-1 & GRI 306):** Perhitungan bersih pengurangan emisi karbon dikurangi emisi solar logistik per ton-kilometer.

---

## 2. Rumus Matematika Deterministik (Dry-Basis QC & Scope-3 ESG)

### A. Penyesuaian Harga Basis Kering (Dynamic Moisture Penalty)
\`\`\`text
V_gross         = W_ordered * P_agreed
V_adjusted      = V_gross * ((100 - M_actual) / (100 - M_contract))
R_buyer_refund  = max(0, V_gross - V_adjusted)
P_seller_net    = V_adjusted - (V_gross * 0.05) - FactoringDiscount
\`\`\`

### B. Kalkulasi Bersih Sertifikat Karbon Scope-3
\`\`\`text
Delta_CO2e_net  = (W_ordered * EF_material) - (W_ordered * D_km * 0.00011)
\`\`\`

---

## 3. Skema Database Produksi PostgreSQL (\`PostGIS\` + \`pgvector\`)

\`\`\`sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) NOT NULL,
    nib_number VARCHAR(20) UNIQUE NOT NULL,
    npwp_number VARCHAR(25) UNIQUE NOT NULL,
    klhk_simpel_id VARCHAR(50),
    role_type VARCHAR(30) CHECK (role_type IN ('PRODUCER', 'BUYER', 'HYBRID', 'AUDITOR')),
    saas_plan VARCHAR(30) DEFAULT 'GROWTH_PRO',
    credit_limit_net60_idr NUMERIC(18, 2) DEFAULT 1500000000,
    plant_coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE material_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    producer_org_id UUID REFERENCES organizations(id),
    title VARCHAR(255) NOT NULL,
    cas_registry_number VARCHAR(50),
    available_metric_tons NUMERIC(12, 2) NOT NULL,
    base_price_per_ton_idr NUMERIC(15, 2) NOT NULL,
    contract_moisture_pct NUMERIC(5, 2) NOT NULL,
    lab_specs_json JSONB NOT NULL,
    chemical_embedding VECTOR(768),
    co2_saving_factor_per_ton NUMERIC(8, 4) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE escrow_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_number VARCHAR(40) UNIQUE NOT NULL,
    listing_id UUID REFERENCES material_listings(id),
    buyer_org_id UUID REFERENCES organizations(id),
    ordered_tons NUMERIC(12, 2) NOT NULL,
    agreed_price_idr NUMERIC(15, 2) NOT NULL,
    payment_term VARCHAR(20) CHECK (payment_term IN ('SPOT_ESCROW', 'NET_30', 'NET_60')),
    contract_moisture_pct NUMERIC(5, 2) NOT NULL,
    actual_weighbridge_moisture_pct NUMERIC(5, 2),
    buyer_refund_idr NUMERIC(18, 2) DEFAULT 0,
    seller_net_payout_idr NUMERIC(18, 2),
    scope3_net_tco2e NUMERIC(12, 4),
    sha256_settlement_hash CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

---

## 4. Payload Webhook Integrasi SAP S/4HANA MM (\`MIGO / BAPI_PO_CREATE1\`)

\`\`\`json
{
  "event": "symbioflow.escrow.three_way_matched",
  "sap_module": "MM_PURCHASING_MIGO",
  "po_reference": "SYM-2026-8821",
  "buyer_nib": "8190200119283",
  "supplier_nib": "9120300492817",
  "material_code": "PKS-GRD-A",
  "cas_number": "68956-68-3",
  "weighbridge_ticket": {
    "vehicle_plate": "B 9481 UEX",
    "net_metric_tons": 120.0,
    "contract_moisture_pct": 11.2,
    "actual_moisture_pct": 13.8
  },
  "settlement_idr": {
    "gross_value": 162000000,
    "moisture_refund_buyer": 4743243,
    "seller_net_payout": 149156757
  },
  "djp_efaktur_nsfp": "010.004-26.88291044",
  "iso27001_chain_hash": "9f84c21e0a77b54d8e1c4a90b6d3f72e1180a4c7d6e9b2f5a8c1d4e7f0a2b3c4"
}
\`\`\`
`;

interface ThreeDigitalTwinProps {
  material: MaterialItem;
  sceneMode: SceneMode;
  onSceneModeChange: (mode: SceneMode) => void;
  wireframe: boolean;
  onToggleWireframe: () => void;
  thermalXray: boolean;
  onToggleThermal: () => void;
  exploded: boolean;
  onToggleExploded: () => void;
  moistureDisplayPct: number;
  compact?: boolean;
}

const ThreeDigitalTwin: React.FC<ThreeDigitalTwinProps> = ({
  material,
  sceneMode,
  onSceneModeChange,
  wireframe,
  onToggleWireframe,
  thermalXray,
  onToggleThermal,
  exploded,
  onToggleExploded,
  moistureDisplayPct,
  compact = false,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [fps, setFps] = useState<number>(60);
  const [vertexCount, setVertexCount] = useState<number>(0);
  const [webglError, setWebglError] = useState<string | null>(null);

  const orbitRef = useRef({
    theta: 0.65,
    phi: 1.08,
    radius: 8.6,
    isDragging: false,
    lastX: 0,
    lastY: 0,
  });

  const resetCamera = useCallback(() => {
    orbitRef.current.theta = 0.65;
    orbitRef.current.phi = 1.08;
    orbitRef.current.radius = 8.6;
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      setWebglError('Konteks WebGL tidak tersedia pada perangkat ini. Telemetri numerik tetap aktif.');
      return;
    }

    setWebglError(null);
    const width = container.clientWidth || 640;
    const height = container.clientHeight || (compact ? 320 : 380);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
    keyLight.position.set(6, 10, 7);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(thermalXray ? 0xef4444 : 0x22d3ee, 1.5, 28);
    rimLight.position.set(-6, 4, -5);
    scene.add(rimLight);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    const disposables: { geometries: THREE.BufferGeometry[]; materials: THREE.Material[] } = {
      geometries: [],
      materials: [],
    };

    const registerMesh = (geom: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh => {
      disposables.geometries.push(geom);
      disposables.materials.push(mat);
      return new THREE.Mesh(geom, mat);
    };

    const spread = exploded ? 1.85 : 1.0;

    if (sceneMode === 'granular') {
      const coreColor = thermalXray ? 0xef4444 : material.coreHex;
      const coreGeom = new THREE.IcosahedronGeometry(1.18, 1);
      const coreMat = new THREE.MeshStandardMaterial({
        color: coreColor,
        roughness: 0.28,
        metalness: 0.45,
        emissive: thermalXray ? 0x7f1d1d : 0x052e16,
        emissiveIntensity: 0.45,
        wireframe,
      });
      const coreMesh = registerMesh(coreGeom, coreMat);
      rootGroup.add(coreMesh);

      const innerGeom = new THREE.OctahedronGeometry(0.72, 0);
      const innerMat = new THREE.MeshStandardMaterial({
        color: thermalXray ? 0xf97316 : 0x22d3ee,
        roughness: 0.2,
        metalness: 0.65,
        wireframe: true,
      });
      rootGroup.add(registerMesh(innerGeom, innerMat));

      // 48 procedural dodecahedron particles representing batch granulation & moisture pockets.
      const particleGeom = new THREE.DodecahedronGeometry(0.16, 0);
      disposables.geometries.push(particleGeom);

      for (let i = 0; i < 48; i++) {
        const goldenAngle = i * 2.3999632;
        const yNorm = 1 - (i / 47) * 2;
        const radial = Math.sqrt(Math.max(0, 1 - yNorm * yNorm));
        const shellRadius = (1.85 + (i % 4) * 0.34) * spread;

        const isHotPocket = i % 5 === 0 || (moistureDisplayPct > material.contractMoisturePct && i % 3 === 0);
        const pColor = thermalXray
          ? isHotPocket
            ? 0xef4444
            : i % 2 === 0
              ? 0xf97316
              : 0x3b82f6
          : isHotPocket
            ? 0x22d3ee
            : material.particleHex;

        const pMat = new THREE.MeshStandardMaterial({
          color: pColor,
          roughness: 0.35,
          metalness: 0.3,
          emissive: thermalXray && isHotPocket ? 0x991b1b : 0x000000,
          emissiveIntensity: thermalXray && isHotPocket ? 0.65 : 0,
          wireframe,
        });
        disposables.materials.push(pMat);

        const particle = new THREE.Mesh(particleGeom, pMat);
        particle.position.set(
          Math.cos(goldenAngle) * radial * shellRadius,
          yNorm * shellRadius * 0.85,
          Math.sin(goldenAngle) * radial * shellRadius
        );
        particle.rotation.set(i * 0.4, i * 0.7, i * 0.2);
        rootGroup.add(particle);
      }

      const ringSpecs = [
        { r: 2.65 * spread, rx: Math.PI / 2.3, ry: 0.2, color: thermalXray ? 0xf97316 : 0x10b981 },
        { r: 3.1 * spread, rx: -Math.PI / 3.1, ry: 0.8, color: thermalXray ? 0x3b82f6 : 0x06b6d4 },
      ];
      ringSpecs.forEach((rk) => {
        const rGeom = new THREE.TorusGeometry(rk.r, 0.022, 12, 72);
        const rMat = new THREE.MeshBasicMaterial({ color: rk.color, wireframe });
        const ring = registerMesh(rGeom, rMat);
        ring.rotation.set(rk.rx, rk.ry, 0);
        rootGroup.add(ring);
      });
    } else if (sceneMode === 'logistics') {
      const boxW = 4.6;
      const boxH = 2.2;
      const boxD = 2.15;

      const containerBoxGeom = new THREE.BoxGeometry(boxW * (exploded ? 1.18 : 1), boxH * (exploded ? 1.18 : 1), boxD * (exploded ? 1.18 : 1));
      disposables.geometries.push(containerBoxGeom);
      const edgesGeom = new THREE.EdgesGeometry(containerBoxGeom);
      disposables.geometries.push(edgesGeom);
      const edgesMat = new THREE.LineBasicMaterial({
        color: thermalXray ? 0x3b82f6 : 0x22d3ee,
      });
      disposables.materials.push(edgesMat);
      const containerWire = new THREE.LineSegments(edgesGeom, edgesMat);
      rootGroup.add(containerWire);

      // Structural pallet floor beneath the 16 FIBC Jumbo Bags.
      const floorGeom = new THREE.BoxGeometry(boxW, 0.12, boxD);
      const floorMat = new THREE.MeshStandardMaterial({
        color: thermalXray ? 0x1e3a8a : 0x334155,
        roughness: 0.7,
        metalness: 0.4,
        wireframe,
      });
      const floorMesh = registerMesh(floorGeom, floorMat);
      floorMesh.position.set(0, -1.12 * spread, 0);
      rootGroup.add(floorMesh);

      const bagGeom = new THREE.BoxGeometry(0.84, 0.78, 0.82);
      disposables.geometries.push(bagGeom);

      let bagIdx = 0;
      for (let ix = 0; ix < 4; ix++) {
        for (let iy = 0; iy < 2; iy++) {
          for (let iz = 0; iz < 2; iz++) {
            const isThermalSpot = bagIdx === 5 || bagIdx === 10 || (moistureDisplayPct > 14 && bagIdx % 4 === 0);
            const bagColor = thermalXray
              ? isThermalSpot
                ? 0xef4444
                : bagIdx % 2 === 0
                  ? 0xf97316
                  : 0x3b82f6
              : isThermalSpot
                ? 0x34d399
                : material.coreHex;

            const bagMat = new THREE.MeshStandardMaterial({
              color: bagColor,
              roughness: 0.45,
              metalness: 0.2,
              emissive: thermalXray && isThermalSpot ? 0x7f1d1d : 0x000000,
              emissiveIntensity: thermalXray && isThermalSpot ? 0.55 : 0,
              wireframe,
            });
            disposables.materials.push(bagMat);

            const bagMesh = new THREE.Mesh(bagGeom, bagMat);
            const xPos = (-1.52 + ix * 1.01) * spread;
            const yPos = (-0.52 + iy * 0.92) * spread;
            const zPos = (-0.48 + iz * 0.96) * spread;
            bagMesh.position.set(xPos, yPos, zPos);
            rootGroup.add(bagMesh);
            bagIdx++;
          }
        }
      }
    } else {
      // Hexagonal industrial park plate + 5 factory silo nodes connected by circular supply chain arcs.
      const hexGeom = new THREE.CylinderGeometry(3.5, 3.65, 0.26, 6);
      const hexMat = new THREE.MeshStandardMaterial({
        color: thermalXray ? 0x172554 : 0x0f172a,
        roughness: 0.75,
        metalness: 0.35,
        wireframe,
      });
      const hexPlate = registerMesh(hexGeom, hexMat);
      hexPlate.position.set(0, -0.95, 0);
      rootGroup.add(hexPlate);

      const hexRingGeom = new THREE.CylinderGeometry(3.55, 3.55, 0.28, 6);
      disposables.geometries.push(hexRingGeom);
      const hexEdges = new THREE.EdgesGeometry(hexRingGeom);
      disposables.geometries.push(hexEdges);
      const hexLineMat = new THREE.LineBasicMaterial({ color: 0x10b981 });
      disposables.materials.push(hexLineMat);
      const hexWire = new THREE.LineSegments(hexEdges, hexLineMat);
      hexWire.position.set(0, -0.95, 0);
      rootGroup.add(hexWire);

      const siloCoords: [number, number, number, number][] = [
        [0, 0, 0, 0x10b981],
        [-2.15, 0, -1.25, 0x22d3ee],
        [2.15, 0, -1.2, 0x34d399],
        [-1.75, 0, 1.85, 0xf59e0b],
        [1.9, 0, 1.75, 0x06b6d4],
      ];

      const siloPositions = siloCoords.map(([x, y, z, col], idx) => {
        const sx = x * spread;
        const sz = z * spread;
        const h = idx === 0 ? 1.45 : 1.05;
        const sGeom = new THREE.CylinderGeometry(0.32, 0.38, h, 16);
        const nodeCol = thermalXray ? (idx === 0 || idx === 3 ? 0xef4444 : 0x3b82f6) : col;
        const sMat = new THREE.MeshStandardMaterial({
          color: nodeCol,
          roughness: 0.3,
          metalness: 0.5,
          emissive: nodeCol,
          emissiveIntensity: 0.22,
          wireframe,
        });
        const siloMesh = registerMesh(sGeom, sMat);
        siloMesh.position.set(sx, y - 0.8 + h / 2, sz);
        rootGroup.add(siloMesh);
        return new THREE.Vector3(sx, y - 0.8 + h, sz);
      });

      const arcPairs: [number, number][] = [
        [0, 1],
        [0, 2],
        [0, 3],
        [0, 4],
        [1, 3],
        [2, 4],
      ];
      arcPairs.forEach(([a, b], idx) => {
        const start = siloPositions[a];
        const end = siloPositions[b];
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        mid.y += (1.15 + (idx % 2) * 0.45) * spread;
        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        const tubeGeom = new THREE.TubeGeometry(curve, 28, 0.035, 8, false);
        const tubeMat = new THREE.MeshBasicMaterial({
          color: thermalXray ? (idx % 2 === 0 ? 0xf97316 : 0xef4444) : idx % 2 === 0 ? 0x10b981 : 0x22d3ee,
          wireframe,
        });
        rootGroup.add(registerMesh(tubeGeom, tubeMat));
      });
    }

    // Count total vertices across all BufferGeometries in the active scene for HUD telemetry.
    let totalVerts = 0;
    rootGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
        const posAttr = obj.geometry.getAttribute('position');
        if (posAttr) totalVerts += posAttr.count;
      }
    });
    setVertexCount(totalVerts);

    const domEl = renderer.domElement;
    domEl.style.touchAction = 'none';

    const onPointerDown = (e: PointerEvent) => {
      orbitRef.current.isDragging = true;
      orbitRef.current.lastX = e.clientX;
      orbitRef.current.lastY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!orbitRef.current.isDragging) return;
      const dx = e.clientX - orbitRef.current.lastX;
      const dy = e.clientY - orbitRef.current.lastY;
      orbitRef.current.lastX = e.clientX;
      orbitRef.current.lastY = e.clientY;
      orbitRef.current.theta -= dx * 0.0085;
      orbitRef.current.phi = Math.max(0.28, Math.min(Math.PI - 0.28, orbitRef.current.phi - dy * 0.0085));
    };

    const onPointerUp = () => {
      orbitRef.current.isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      orbitRef.current.radius = Math.max(4.2, Math.min(15.5, orbitRef.current.radius + e.deltaY * 0.006));
    };

    domEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    domEl.addEventListener('wheel', onWheel, { passive: false });

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const nw = entry.contentRect.width;
        const nh = entry.contentRect.height;
        if (nw > 0 && nh > 0) {
          camera.aspect = nw / nh;
          camera.updateProjectionMatrix();
          renderer.setSize(nw, nh);
        }
      }
    });
    resizeObserver.observe(container);

    let animId = 0;
    let frameCounter = 0;
    let fpsTimer = performance.now();

    const renderLoop = (now: number) => {
      animId = requestAnimationFrame(renderLoop);
      frameCounter++;
      if (now - fpsTimer >= 600) {
        const measured = Math.round((frameCounter * 1000) / (now - fpsTimer));
        setFps(Math.min(120, Math.max(24, measured)));
        frameCounter = 0;
        fpsTimer = now;
      }

      if (!orbitRef.current.isDragging) {
        orbitRef.current.theta += 0.0022;
      }

      const { radius, phi, theta } = orbitRef.current;
      camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
      camera.position.y = radius * Math.cos(phi);
      camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      domEl.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      domEl.removeEventListener('wheel', onWheel);
      disposables.geometries.forEach((g) => g.dispose());
      disposables.materials.forEach((m) => m.dispose());
      renderer.dispose();
    };
  }, [material, sceneMode, wireframe, thermalXray, exploded, moistureDisplayPct, compact]);

  const handleCanvasKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      orbitRef.current.theta -= 0.14;
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      orbitRef.current.theta += 0.14;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      orbitRef.current.phi = Math.max(0.28, orbitRef.current.phi - 0.12);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      orbitRef.current.phi = Math.min(Math.PI - 0.28, orbitRef.current.phi + 0.12);
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      orbitRef.current.radius = Math.max(4.2, orbitRef.current.radius - 0.6);
    } else if (e.key === '-') {
      e.preventDefault();
      orbitRef.current.radius = Math.min(15.5, orbitRef.current.radius + 0.6);
    }
  };

  return (
    <div className="rounded-xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" />
          <span className="text-sm font-semibold text-slate-100">
            3D WebGL Digital Twin Inspector
          </span>
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/50 text-cyan-300">
            {material.code}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'granular', label: '1. Granular & Kimia' },
              { id: 'logistics', label: '2. Kontainer 20ft FIBC' },
              { id: 'network', label: '3. Peta Simbiosis 3D' },
            ] as { id: SceneMode; label: string }[]
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onSceneModeChange(m.id)}
              className={`min-h-[38px] sm:min-h-[34px] px-2.5 py-1.5 rounded-lg text-xs font-medium transition border ${
                sceneMode === m.id
                  ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-semibold'
                  : 'bg-slate-950/80 text-slate-300 border-slate-600 hover:border-cyan-400/70'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`relative w-full ${compact ? 'h-[300px] sm:h-[330px]' : 'h-[330px] sm:h-[390px]'} bg-[#070D17] select-none cursor-grab active:cursor-grabbing`}
        tabIndex={0}
        role="region"
        aria-label={`Inspektor 3D Digital Twin untuk ${material.shortName}. Gunakan drag mouse atau tombol panah keyboard untuk memutar 360 derajat, serta scroll atau tombol plus minus untuk zoom.`}
        onKeyDown={handleCanvasKeyDown}
      >
        <div ref={mountRef} className="w-full h-full" />

        {webglError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#070D17]/95">
            <AlertTriangle className="w-7 h-7 text-amber-400 mb-2" aria-hidden="true" />
            <p className="text-sm text-slate-200 max-w-md">{webglError}</p>
          </div>
        )}

        <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap gap-2">
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-slate-700 text-xs">
            <span className="text-slate-400 block text-[10px]">TELEMETRI GPU</span>
            <span className="font-mono text-emerald-400 font-semibold">{fps} FPS</span>
            <span className="text-slate-400 mx-1.5">|</span>
            <span className="font-mono text-cyan-300">{vertexCount.toLocaleString('id-ID')} Vertices</span>
          </div>
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-slate-700 text-xs">
            <span className="text-slate-400 block text-[10px]">CAS REGISTRY &amp; MOISTURE</span>
            <span className="font-mono text-slate-100">{material.casNumber}</span>
            <span className="text-slate-400 mx-1.5">|</span>
            <span
              className={`font-mono font-semibold ${
                moistureDisplayPct > material.contractMoisturePct ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              H2O {formatDecimalId(moistureDisplayPct, 1)}%
            </span>
          </div>
        </div>

        {thermalXray && (
          <div className="pointer-events-none absolute top-3 right-3 px-2.5 py-1.5 rounded-lg bg-rose-950/90 border border-rose-500/70 text-xs font-mono text-rose-200">
            THERMAL X-RAY AKTIF: DETEKSI MOISTURE POCKET
          </div>
        )}

        <div className="absolute bottom-3 right-3">
          <button
            type="button"
            onClick={resetCamera}
            title="Reset Sudut Kamera 3D"
            className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-slate-500 text-xs text-slate-200 hover:border-emerald-400 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
            <span>Reset 360°</span>
          </button>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleWireframe}
            aria-pressed={wireframe}
            className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition ${
              wireframe
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-semibold'
                : 'bg-slate-900 text-slate-200 border-slate-500 hover:border-emerald-400'
            }`}
          >
            <Box className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Wireframe</span>
          </button>
          <button
            type="button"
            onClick={onToggleThermal}
            aria-pressed={thermalXray}
            className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition ${
              thermalXray
                ? 'bg-rose-500 text-slate-950 border-rose-300 font-semibold'
                : 'bg-slate-900 text-slate-200 border-slate-500 hover:border-rose-400'
            }`}
          >
            <Flame className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Thermal X-Ray</span>
          </button>
          <button
            type="button"
            onClick={onToggleExploded}
            aria-pressed={exploded}
            className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition ${
              exploded
                ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-semibold'
                : 'bg-slate-900 text-slate-200 border-slate-500 hover:border-cyan-400'
            }`}
          >
            <Layers className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Exploded View (1.85x)</span>
          </button>
        </div>
        <span className="text-xs text-slate-400">
          Geser mouse/layar untuk rotasi 360°, scroll untuk zoom
        </span>
      </div>
    </div>
  );
};

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('workflow');
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [dataViewState, setDataViewState] = useState<DataViewState>('ready');

  // Ticker state with live spot simulation refresh
  const [tickers, setTickers] = useState<CommodityTicker[]>(INITIAL_TICKERS);

  // Multi-role Corporate Accounts & KYB Onboarding state
  const [accounts, setAccounts] = useState<RoleAccount[]>(PRESET_ACCOUNTS);
  const [activeAccountId, setActiveAccountId] = useState<string>('acc-buyer');
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'DemoSwitch' | 'RegisterKyb'>('DemoSwitch');

  const [kybCompany, setKybCompany] = useState<string>('');
  const [kybNib, setKybNib] = useState<string>('');
  const [kybEmail, setKybEmail] = useState<string>('');
  const [kybRole, setKybRole] = useState<'PRODUCER' | 'BUYER' | 'HYBRID'>('BUYER');
  const [kybLicense, setKybLicense] = useState<string>('SIMPEL-KLHK Pemanfaatan Biomassa & Non-B3');
  const [kybError, setKybError] = useState<string | null>(null);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) ?? accounts[1],
    [accounts, activeAccountId]
  );

  // Ctrl+K Command Palette & Notifications
  const [cmdOpen, setCmdOpen] = useState<boolean>(false);
  const [cmdQuery, setCmdQuery] = useState<string>('');
  const [notifOpen, setNotifOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'n-1',
      title: 'Hasil Lab Sucofindo Terverifikasi (98.4% Match)',
      detail: 'Batch PKS-GRD-A 450 Ton dari PT Agro Sawit Lestari siap dikunci pada Smart Escrow.',
      time: '4 menit lalu',
      unread: true,
      targetTab: 'marketplace',
    },
    {
      id: 'n-2',
      title: 'Tender Baru PT Semen Hijau Nusantara',
      detail: 'Kebutuhan 1.500 Ton Fly Ash Kelas F (TCLP Pass) di Tuban sedang berlangsung.',
      time: '19 menit lalu',
      unread: true,
      targetTab: 'tenders',
    },
    {
      id: 'n-3',
      title: 'Tiket Jembatan Timbang Truk B 9481 UEX Masuk',
      detail: 'Moisture aktual tercatat 13.4% vs kontrak 11.2%. Kalkulasi refund otomatis aktif.',
      time: '42 menit lalu',
      unread: false,
      targetTab: 'qcesg',
    },
  ]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 4200);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  // 3D WebGL Digital Twin shared controls
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('pks');
  const [sceneMode, setSceneMode] = useState<SceneMode>('granular');
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [thermalXray, setThermalXray] = useState<boolean>(false);
  const [exploded, setExploded] = useState<boolean>(false);

  const selectedMaterial = useMemo(
    () => MATERIALS.find((m) => m.id === selectedMaterialId) ?? MATERIALS[0],
    [selectedMaterialId]
  );

  // Tab 1: 7-Stage Workflow & AI Lab Scanner (0% to 100%)
  const [workflowStep, setWorkflowStep] = useState<number>(1);
  const [scanProgress, setScanProgress] = useState<number>(100);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  useEffect(() => {
    if (!isScanning) return;
    const iv = window.setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          setIsScanning(false);
          return 100;
        }
        return Math.min(100, prev + 5);
      });
    }, 85);
    return () => window.clearInterval(iv);
  }, [isScanning]);

  const startAiLabScanner = () => {
    setWorkflowStep(2);
    setScanProgress(0);
    setIsScanning(true);
  };

  // Tab 2: Bursa Filter & Contract Simulator state
  const [catalogQuery, setCatalogQuery] = useState<string>('');
  const [paymentTerm, setPaymentTerm] = useState<PaymentTerm>('NET_60');
  const [orderTons, setOrderTons] = useState<number>(120);
  const [offerPricePerTon, setOfferPricePerTon] = useState<number>(1350000);
  const [cargoInsurance, setCargoInsurance] = useState<boolean>(true);
  const [earlyFactoring, setEarlyFactoring] = useState<boolean>(true);
  const [activePoNumber, setActivePoNumber] = useState<string>('#SYM-2026-8821');

  const handleSelectMaterial = (mat: MaterialItem) => {
    setSelectedMaterialId(mat.id);
    setOrderTons(Math.min(120, mat.availableTons));
    setOfferPricePerTon(mat.pricePerTon);
    setActualMoisturePct(Number((mat.contractMoisturePct + 1.8).toFixed(1)));
  };

  const filteredMaterials = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    if (!q) return MATERIALS;
    return MATERIALS.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        m.casNumber.toLowerCase().includes(q) ||
        m.originCity.toLowerCase().includes(q)
    );
  }, [catalogQuery]);

  // Tab 3: Reverse Auction RFQ Board & New Tender Form
  const [tenders, setTenders] = useState<TenderItem[]>(INITIAL_TENDERS);
  const [tenderFilter, setTenderFilter] = useState<string>('');
  const [newRfqMaterial, setNewRfqMaterial] = useState<string>('');
  const [newRfqTons, setNewRfqTons] = useState<string>('500');
  const [newRfqCeilingPrice, setNewRfqCeilingPrice] = useState<string>('850000');
  const [newRfqMoisture, setNewRfqMoisture] = useState<string>('8.0');
  const [newRfqSpec, setNewRfqSpec] = useState<string>('');
  const [rfqFormError, setRfqFormError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTenders((prev) =>
        prev.map((item) => ({
          ...item,
          secondsLeft: item.secondsLeft > 0 ? item.secondsLeft - 1 : 0,
        }))
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const filteredTenders = useMemo(() => {
    const q = tenderFilter.trim().toLowerCase();
    if (!q) return tenders;
    return tenders.filter(
      (t) =>
        t.buyerCompany.toLowerCase().includes(q) ||
        t.materialNeeded.toLowerCase().includes(q) ||
        t.location.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q)
    );
  }, [tenders, tenderFilter]);

  // Tab 4: Deal Room Chat, Contact Modals & PDF Attachment Inspector
  const [contactModal, setContactModal] = useState<
    null | 'video' | 'sample' | 'whatsapp' | 'manager'
  >(null);
  const [inspectedAttachment, setInspectedAttachment] = useState<ChatAttachment | null>(null);
  const [selectedPicPartner, setSelectedPicPartner] = useState<string>(
    'PT Agro Sawit Lestari Tbk'
  );
  const [chatInput, setChatInput] = useState<string>('');
  const [partnerTyping, setPartnerTyping] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'm-1',
      sender: 'Ir. Hendra Wijaya, M.T.',
      company: 'PT Agro Sawit Lestari Tbk',
      roleTag: 'Pemasok Terverifikasi KLHK',
      timestamp: '09:14 WIB',
      text: 'Selamat pagi Tim Procurement PT Energi Biomassa Nusantara. Stok PKS Grade A di Gudang Gresik siap 450 Metrik Ton. Berikut hasil uji kalor dan moisture terbaru dari Sucofindo.',
      attachment: {
        fileName: 'COA_Sucofindo_PKS_Oct2026.pdf',
        labIssuer: 'PT Sucofindo Laboratorium Gresik (ISO/IEC 17025)',
        hash: computeDeterministicHash('COA_Sucofindo_PKS_Oct2026.pdf'),
        summary:
          'Net Calorific Value: 4,450 kcal/kg | Total Moisture (AR): 11.20% | Ash Content: 2.35% | Total Sulfur: 0.08% | Foreign Matter: < 0.5%',
      },
    },
    {
      id: 'm-2',
      sender: 'Sarah Kusuma, MBA, CPSM',
      company: 'PT Energi Biomassa Nusantara',
      roleTag: 'VP Procurement (Buyer)',
      timestamp: '09:19 WIB',
      text: 'Terima kasih Pak Hendra. Dokumen COA sudah terbaca di sistem kami. Kami berencana mengunci tahap awal 120 Metrik Ton menggunakan fasilitas Smart Escrow Net-60 dengan toleransi penalti basis kering otomatis di jembatan timbang Cikarang.',
      attachment: {
        fileName: 'MSDS_KLHK_NonB3_Biomassa_2026.pdf',
        labIssuer: 'Registrasi SIMPEL-KLHK & K3 Industri',
        hash: computeDeterministicHash('MSDS_KLHK_NonB3_Biomassa_2026.pdf'),
        summary:
          'Klasifikasi GHS: Non-Berbahaya (Biomassa Padat) | CAS: 68956-68-3 | Titik Nyala: > 240°C | Prosedur Simpan: Ventilasi kering < 15% H2O',
      },
    },
  ]);

  // Contact channel modal states
  const [videoDate, setVideoDate] = useState<string>('2026-10-29');
  const [videoSlot, setVideoSlot] = useState<string>('10:00 - 10:45 WIB (Kamera Stockpile Bay 3)');
  const [sampleAddress, setSampleAddress] = useState<string>(
    'Lab QC Penerimaan Bahan Baku, Kawasan Industri Jababeka Tahap II Blok EE-4, Cikarang'
  );
  const [sampleCourier, setSampleCourier] = useState<string>('SymbioExpress Same-Day Industrial Cold/Dry Seal');
  const [waPhone, setWaPhone] = useState<string>('+628113409928');
  const [waAutoArchive, setWaAutoArchive] = useState<boolean>(true);
  const [amNotes, setAmNotes] = useState<string>(
    'Permohonan strukturisasi kontrak pasokan rutin 300 Ton/bulan dengan lindung nilai harga kuartalan.'
  );

  // Tab 5: Dynamic Moisture Penalty, 3-Way Matching & Scope-3 Carbon Certificate
  const [actualMoisturePct, setActualMoisturePct] = useState<number>(13.4);
  const [haulDistanceKm, setHaulDistanceKm] = useState<number>(185);
  const [threeWayRechecking, setThreeWayRechecking] = useState<boolean>(false);
  const [lastThreeWayCheckTime, setLastThreeWayCheckTime] = useState<string>('09:40:12 WIB');

  // Tab 6: CBO Unit Economics Simulator, SaaS Tiers, ERP Webhooks & Audit Logs
  const [monthlyGmvBillion, setMonthlyGmvBillion] = useState<number>(65);
  const [selectedSaasTier, setSelectedSaasTier] = useState<'STARTER' | 'GROWTH_PRO' | 'ENTERPRISE'>(
    'ENTERPRISE'
  );
  const [erpConnectors, setErpConnectors] = useState<ErpConnector[]>([
    {
      id: 'sap',
      name: 'SAP S/4HANA MM',
      protocol: 'OData v4 / BAPI_PO_CREATE1 & MIGO',
      endpoint: 'https://sap-gw.energibiomassa.co.id/sap/opu/odata4/symbio/migo',
      connected: true,
      lastSync: '2 menit lalu (HTTP 200 OK)',
    },
    {
      id: 'netsuite',
      name: 'Oracle NetSuite',
      protocol: 'SuiteTalk REST 3-Way Vendor Bill',
      endpoint: 'https://7729104.suitetalk.api.netsuite.com/services/rest/record/v1',
      connected: true,
      lastSync: '11 menit lalu (HTTP 200 OK)',
    },
    {
      id: 'odoo',
      name: 'Odoo ERP Manufacturing',
      protocol: 'JSON-RPC Inventory Lot & QC',
      endpoint: 'https://erp.agrosawit.co.id/jsonrpc/2/object',
      connected: false,
      lastSync: 'Siaga (Belum Diaktifkan)',
    },
    {
      id: 'djp',
      name: 'DJP Host-to-Host e-Faktur',
      protocol: 'PJAP PPN 11% Real-Time NSFP Validator',
      endpoint: 'https://efaktur-pjap.pajak.go.id/api/v3/validate-faktur',
      connected: true,
      lastSync: '1 menit lalu (NSFP Valid)',
    },
  ]);

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([
    {
      id: 'al-1',
      timestamp: '2026-10-28 09:12:04',
      actorNib: '9120300492817',
      company: 'PT Agro Sawit Lestari Tbk',
      eventAction: 'UNGGAH_COA_SUCOFINDO_VEKTOR_768D (PKS-GRD-A)',
      sha256Hash: computeDeterministicHash('init-1-9120300492817'),
      status: 'VERIFIED',
    },
    {
      id: 'al-2',
      timestamp: '2026-10-28 09:26:41',
      actorNib: '8190200119283',
      company: 'PT Energi Biomassa Nusantara',
      eventAction: 'KUNCI_SMART_ESCROW_NET60 (#SYM-2026-8821 | 120 Ton)',
      sha256Hash: computeDeterministicHash('init-2-8190200119283'),
      status: 'LOCKED',
    },
    {
      id: 'al-3',
      timestamp: '2026-10-28 09:40:12',
      actorNib: '8190200119283',
      company: 'SAP S/4HANA MM Bridge',
      eventAction: 'WEBHOOK_3WAY_MATCH_MIGO_POSTED (B 9481 UEX)',
      sha256Hash: computeDeterministicHash('init-3-sap-migo'),
      status: 'SYNCED',
    },
  ]);

  const appendAuditLog = useCallback(
    (action: string, status: 'VERIFIED' | 'LOCKED' | 'SYNCED' = 'VERIFIED') => {
      const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19);
      setAuditLogs((prev) => {
        const prevHash = prev[0]?.sha256Hash ?? '0000';
        const nextHash = computeDeterministicHash(`${prevHash}|${activeAccount.nib}|${action}|${nowIso}`);
        return [
          {
            id: `al-${Date.now()}`,
            timestamp: nowIso,
            actorNib: activeAccount.nib,
            company: activeAccount.companyName,
            eventAction: action,
            sha256Hash: nextHash,
            status,
          },
          ...prev,
        ];
      });
    },
    [activeAccount]
  );

  // Tab 7: Master .MD Viewer filter & copy state
  const [mdSectionFilter, setMdSectionFilter] = useState<'ALL' | 'SQL' | 'WEBHOOK' | 'MATH'>('ALL');
  const [copiedMd, setCopiedMd] = useState<boolean>(false);

  // Global Keyboard Shortcuts: Ctrl+K / Cmd+K and Escape for all modals/drawers
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setCmdOpen(false);
        setAuthModalOpen(false);
        setContactModal(null);
        setInspectedAttachment(null);
        setNotifOpen(false);
        setMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Deterministic Calculations: Tab 2 Contract & Financing
  const contractCalc = useMemo(() => {
    const gross = orderTons * offerPricePerTon;
    const insuranceFee = cargoInsurance ? gross * 0.0025 : 0;
    const termRate = paymentTerm === 'SPOT_ESCROW' ? 0 : paymentTerm === 'NET_30' ? 0.012 : 0.024;
    const financingFee = gross * termRate;
    const buyerTotal = gross + insuranceFee + financingFee;
    const platformCommission = gross * 0.05;
    const factoringFee = earlyFactoring ? gross * 0.0125 : 0;
    const sellerEstimatedNet = gross - platformCommission - factoringFee;
    return {
      gross,
      insuranceFee,
      termRate,
      financingFee,
      buyerTotal,
      platformCommission,
      factoringFee,
      sellerEstimatedNet,
    };
  }, [orderTons, offerPricePerTon, cargoInsurance, paymentTerm, earlyFactoring]);

  // Deterministic Calculations: Tab 5 Dynamic Moisture QC & Scope-3 Carbon
  const qcAndCarbonCalc = useMemo(() => {
    const mContract = selectedMaterial.contractMoisturePct;
    const vGross = orderTons * offerPricePerTon;
    const dryRatio = (100 - actualMoisturePct) / (100 - mContract);
    const vAdjusted = vGross * dryRatio;
    const rBuyerRefund = Math.max(0, vGross - vAdjusted);
    const factoringDiscount = earlyFactoring ? vGross * 0.0125 : 0;
    const platformFee = vGross * 0.05;
    const pSellerNet = vAdjusted - platformFee - factoringDiscount;

    const grossAvoidedCo2 = orderTons * selectedMaterial.co2FactorPerTon;
    const haulageEmissionCo2 = orderTons * haulDistanceKm * 0.00011;
    const netCo2Reduction = grossAvoidedCo2 - haulageEmissionCo2;
    const carbonEconomicValueIdr = Math.max(0, netCo2Reduction) * 98500;

    return {
      mContract,
      vGross,
      vAdjusted,
      rBuyerRefund,
      factoringDiscount,
      platformFee,
      pSellerNet,
      grossAvoidedCo2,
      haulageEmissionCo2,
      netCo2Reduction,
      carbonEconomicValueIdr,
    };
  }, [
    selectedMaterial,
    orderTons,
    offerPricePerTon,
    actualMoisturePct,
    earlyFactoring,
    haulDistanceKm,
  ]);

  // Deterministic Calculations: Tab 6 Chief Business Officer Unit Economics
  const cboEconomics = useMemo(() => {
    const gmvIdr = monthlyGmvBillion * 1_000_000_000;
    const escrowRevenue = gmvIdr * 0.045;
    const tradeFinanceYield = gmvIdr * 0.45 * 0.024;
    const activeEnterprisePlants = Math.round(24 + monthlyGmvBillion * 1.35);
    const saasSubscriptionRevenue = activeEnterprisePlants * 11_500_000;
    const greenFreightInsuranceRevenue = gmvIdr * 0.0085;
    const monthlyNetRevenue =
      escrowRevenue + tradeFinanceYield + saasSubscriptionRevenue + greenFreightInsuranceRevenue;
    const annualizedArr = monthlyNetRevenue * 12;
    const blendedTakeRatePct = (monthlyNetRevenue / gmvIdr) * 100;
    return {
      gmvIdr,
      escrowRevenue,
      tradeFinanceYield,
      activeEnterprisePlants,
      saasSubscriptionRevenue,
      greenFreightInsuranceRevenue,
      monthlyNetRevenue,
      annualizedArr,
      blendedTakeRatePct,
    };
  }, [monthlyGmvBillion]);

  const isReadOnlyAuditor = activeAccount.roleCode === 'AUDITOR';

  // Action Handlers
  const refreshSpotTickers = () => {
    setTickers((prev) =>
      prev.map((tk, i) => {
        const shift = ((i % 2 === 0 ? 1 : -1) * 0.2);
        const nextDelta = Number((tk.deltaPct + shift).toFixed(1));
        const nextPrice = Math.round(tk.priceIdr * (1 + shift / 100));
        return { ...tk, priceIdr: nextPrice, deltaPct: nextDelta };
      })
    );
    triggerToast('Indeks Harga Spot Sirkular diperbarui dari bursa transaksi terkini.');
  };

  const handleSendCounterOffer = () => {
    if (isReadOnlyAuditor) {
      triggerToast('Mode Auditor KLHK bersifat Read-Only: tidak dapat mengirim Counter-Offer.');
      return;
    }
    const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    const msgText = `[COUNTER-OFFER RESMI] Pengajuan pembelian ${orderTons} Metrik Ton ${selectedMaterial.shortName} pada harga ${formatRupiah(offerPricePerTon)}/Ton (${paymentTerm.replace('_', ' ')}). Estimasi nilai kontrak gross: ${formatRupiah(contractCalc.gross)}.`;
    setChatMessages((prev) => [
      ...prev,
      {
        id: `m-${Date.now()}`,
        sender: activeAccount.personName,
        company: activeAccount.companyName,
        roleTag: activeAccount.roleLabel,
        timestamp: nowTime,
        text: msgText,
        isCounterOffer: true,
      },
    ]);
    appendAuditLog(`KIRIM_COUNTER_OFFER (${selectedMaterial.code} | ${orderTons}t @ ${offerPricePerTon})`);
    setActiveTab('dealroom');
    triggerToast('Counter-Offer terkirim ke Deal Room terenkripsi.');

    setPartnerTyping(true);
    window.setTimeout(() => {
      setPartnerTyping(false);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `m-reply-${Date.now()}`,
          sender: 'Ir. Hendra Wijaya, M.T.',
          company: selectedMaterial.supplierName,
          roleTag: 'Pemasok Terverifikasi KLHK',
          timestamp: nowTime,
          text: `Counter-Offer ${orderTons} Ton (${formatRupiah(offerPricePerTon)}/Ton) telah diterima meja komersial kami. Kuota siap dikunci melalui Smart Escrow dengan klausul QC Moisture kontrak ${selectedMaterial.contractMoisturePct}%.`,
        },
      ]);
    }, 1000);
  };

  const handleLockSmartEscrow = () => {
    if (isReadOnlyAuditor) {
      triggerToast('Mode Auditor KLHK bersifat Read-Only: penguncian kontrak dinonaktifkan.');
      return;
    }
    if (paymentTerm !== 'SPOT_ESCROW' && contractCalc.buyerTotal > activeAccount.creditLimitIdr) {
      triggerToast('Plafon Kredit Net-60 tidak mencukupi untuk nilai kontrak ini. Kurangi tonase atau pilih Spot Escrow.');
      return;
    }
    if (paymentTerm === 'SPOT_ESCROW' && contractCalc.buyerTotal > activeAccount.escrowBalanceIdr) {
      triggerToast('Saldo Escrow VA tidak mencukupi. Gunakan fasilitas Net-30 / Net-60 atau kurangi volume.');
      return;
    }

    const nextPo = `#SYM-2026-${Math.floor(8830 + (Date.now() % 1100))}`;
    setActivePoNumber(nextPo);
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id !== activeAccount.id) return acc;
        if (paymentTerm === 'SPOT_ESCROW') {
          return { ...acc, escrowBalanceIdr: Math.max(0, acc.escrowBalanceIdr - contractCalc.buyerTotal) };
        }
        return { ...acc, creditLimitIdr: Math.max(0, acc.creditLimitIdr - contractCalc.buyerTotal) };
      })
    );
    appendAuditLog(
      `LOCK_SMART_ESCROW (${nextPo} | ${selectedMaterial.code} | ${orderTons}t | ${formatRupiah(contractCalc.buyerTotal)})`,
      'LOCKED'
    );
    setNotifications((prev) => [
      {
        id: `n-${Date.now()}`,
        title: `Kontrak Smart Escrow ${nextPo} Terkunci`,
        detail: `${orderTons} Ton ${selectedMaterial.shortName} berhasil diamankan (${paymentTerm.replace('_', ' ')}).`,
        time: 'Baru saja',
        unread: true,
        targetTab: 'qcesg',
      },
      ...prev,
    ]);
    triggerToast(`Kontrak Smart Escrow ${nextPo} berhasil dikunci. Silakan cek rekonsiliasi di Tab 5. QC & ESG.`);
  };

  const handlePlaceLowerBid = (tenderId: string) => {
    if (isReadOnlyAuditor) {
      triggerToast('Mode Auditor KLHK bersifat Read-Only: penawaran lelang dinonaktifkan.');
      return;
    }
    const target = tenders.find((t) => t.id === tenderId);
    if (!target) return;
    const lowered = Math.round(target.lowestBidIdr * 0.985);
    setTenders((prev) =>
      prev.map((t) =>
        t.id === tenderId
          ? {
              ...t,
              lowestBidIdr: lowered,
              bidCount: t.bidCount + 1,
              leadingBidder: activeAccount.companyName,
            }
          : t
      )
    );
    appendAuditLog(`REVERSE_AUCTION_BID_-1.5% (${target.code} -> ${formatRupiah(lowered)}/t)`);
    triggerToast(`Bid baru (-1.5%) sebesar ${formatRupiah(lowered)}/t tercatat pada ${target.code}.`);
  };

  const handlePublishNewTender = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnlyAuditor) {
      setRfqFormError('Akun Auditor bersifat Read-Only dan tidak dapat menerbitkan tender pengadaan.');
      return;
    }
    const tonsNum = Number(newRfqTons);
    const priceNum = Number(newRfqCeilingPrice);
    const moistNum = Number(newRfqMoisture);
    if (!newRfqMaterial.trim() || !newRfqSpec.trim()) {
      setRfqFormError('Nama komoditas dan spesifikasi teknis wajib diisi lengkap.');
      return;
    }
    if (!Number.isFinite(tonsNum) || tonsNum < 10) {
      setRfqFormError('Volume minimal tender B2B adalah 10 Metrik Ton.');
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 50000) {
      setRfqFormError('Harga pagu awal minimal Rp 50.000/Ton.');
      return;
    }
    setRfqFormError(null);
    const code = `RFQ-SYM-2026-${Math.floor(300 + (Date.now() % 699))}`;
    const created: TenderItem = {
      id: `rfq-${Date.now()}`,
      code,
      buyerCompany: activeAccount.companyName,
      location: activeAccount.city,
      materialNeeded: newRfqMaterial.trim(),
      volumeTons: tonsNum,
      specSummary: newRfqSpec.trim(),
      maxMoisturePct: Number.isFinite(moistNum) ? moistNum : 10,
      lowestBidIdr: priceNum,
      bidCount: 1,
      secondsLeft: 28800,
      leadingBidder: 'Menunggu Bid Pemasok',
    };
    setTenders((prev) => [created, ...prev]);
    setNewRfqMaterial('');
    setNewRfqSpec('');
    appendAuditLog(`PUBLISH_NEW_RFQ_TENDER (${code} | ${tonsNum}t @ Pagu ${formatRupiah(priceNum)}/t)`);
    triggerToast(`Tender ${code} berhasil dipublikasikan ke papan lelang terbuka.`);
  };

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    setChatMessages((prev) => [
      ...prev,
      {
        id: `m-${Date.now()}`,
        sender: activeAccount.personName,
        company: activeAccount.companyName,
        roleTag: activeAccount.roleLabel,
        timestamp: nowTime,
        text: trimmed,
      },
    ]);
    setChatInput('');
    setPartnerTyping(true);

    window.setTimeout(() => {
      setPartnerTyping(false);
      const lower = trimmed.toLowerCase();
      let reply = `Pesan Anda telah tercatat dalam log transaksi ${activePoNumber} bersama ${selectedPicPartner}. Tim operasional pabrik siap menindaklanjuti jadwal pemuatan FIBC Jumbo Bag.`;
      if (lower.includes('moisture') || lower.includes('kadar air') || lower.includes('basah')) {
        reply = `Terkait kadar air: batch ${selectedMaterial.code} dijaga pada silo tertutup (kontrak ${selectedMaterial.contractMoisturePct}%). Selisih di atas ambang tersebut otomatis dipotong melalui formula basis kering Smart Escrow.`;
      } else if (lower.includes('sampel') || lower.includes('sample') || lower.includes('uji')) {
        reply = `Sampel fisik 15 kg bersegel QR dapat kami kirim hari ini menuju laboratorium penerimaan Anda lengkap dengan berita acara chain-of-custody.`;
      } else if (lower.includes('harga') || lower.includes('diskon') || lower.includes('net')) {
        reply = `Untuk volume >= 120 Metrik Ton dengan skema Net-60, kami menyetujui struktur harga yang diajukan selama pencairan Early Factoring T+0 diaktifkan.`;
      }
      setChatMessages((prev) => [
        ...prev,
        {
          id: `m-auto-${Date.now()}`,
          sender: 'Desk Komersial Mitra Terverifikasi',
          company: selectedPicPartner,
          roleTag: 'Mitra B2B Terenkripsi',
          timestamp: nowTime,
          text: reply,
        },
      ]);
    }, 1000);
  };

  const handleRegisterKyb = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNib = kybNib.replace(/\D/g, '');
    if (kybCompany.trim().length < 4) {
      setKybError('Nama badan usaha (PT/CV) wajib diisi minimal 4 karakter.');
      return;
    }
    if (cleanNib.length !== 13) {
      setKybError('Nomor Induk Berusaha (NIB OSS) wajib terdiri dari tepat 13 digit angka.');
      return;
    }
    if (!kybEmail.includes('@') || !kybEmail.includes('.')) {
      setKybError('Masukkan alamat email korporat yang valid.');
      return;
    }
    setKybError(null);
    const newId = `acc-${Date.now()}`;
    const roleLabelMap = {
      PRODUCER: 'Generator (Penghasil Limbah)',
      BUYER: 'Buyer (Pabrik Pemanfaat)',
      HYBRID: 'Hybrid (Penghasil & Pemanfaat Sirkular)',
    };
    const newAcc: RoleAccount = {
      id: newId,
      roleCode: kybRole,
      roleLabel: roleLabelMap[kybRole],
      personName: kybEmail.split('@')[0].replace(/[._]/g, ' ').toUpperCase(),
      companyName: kybCompany.trim(),
      city: 'Kawasan Industri Terdaftar',
      nib: cleanNib,
      klhkStatus: `${kybLicense} (KYB Active)`,
      creditLimitIdr: 2000000000,
      escrowBalanceIdr: 500000000,
      saasPlan: 'GROWTH_PRO',
      ownerSummary: `${kybCompany.trim()} (NIB: ${cleanNib}, ${kybLicense}, Credit Limit: Rp 2,0 Miliar)`,
    };
    setAccounts((prev) => [...prev, newAcc]);
    setActiveAccountId(newId);
    setAuthModalOpen(false);
    setKybCompany('');
    setKybNib('');
    setKybEmail('');
    appendAuditLog(`ONBOARDING_KYB_NIB_VERIFIED (${cleanNib} | Plafon Net-60 Rp 2.000.000.000)`);
    triggerToast(`Verifikasi KYB ${newAcc.companyName} berhasil! Plafon Net-60 Rp 2.000.000.000 telah aktif.`);
  };

  const handleDownloadCarbonCertificate = () => {
    const certHash = computeDeterministicHash(
      `${activePoNumber}|${activeAccount.nib}|${qcAndCarbonCalc.netCo2Reduction.toFixed(4)}`
    );
    const content = [
      '================================================================================',
      'SYMBIOFLOW ENTERPRISE v4.0 - AUDIT-GRADE SCOPE-3 CARBON REDUCTION CERTIFICATE',
      'Standar Verifikasi: ISO 14064-1:2018 & GRI 306 (Circular Waste Diverted)',
      '================================================================================',
      `Nomor Sertifikat     : CERT-S3-2026-${certHash.slice(0, 10).toUpperCase()}`,
      `Referensi Kontrak PO : ${activePoNumber}`,
      `Organisasi Penerima  : ${activeAccount.companyName}`,
      `Nomor NIB 13-Digit   : ${activeAccount.nib}`,
      `Status Izin KLHK     : ${activeAccount.klhkStatus}`,
      '--------------------------------------------------------------------------------',
      `Material Sirkular    : ${selectedMaterial.name}`,
      `Nomor CAS Kimia      : ${selectedMaterial.casNumber}`,
      `Volume Terverifikasi : ${orderTons} Metrik Ton (Tiket Timbang: Truck B 9481 UEX)`,
      `Faktor Emisi Material: ${selectedMaterial.co2FactorPerTon} tCO2e / Ton`,
      `Jarak Tempuh Armada  : ${haulDistanceKm} km (@ 0.00011 tCO2e / ton-km)`,
      '--------------------------------------------------------------------------------',
      `Emisi Virgin Dicegah : ${qcAndCarbonCalc.grossAvoidedCo2.toFixed(3)} tCO2e`,
      `Deduksi Emisi Truk   : -${qcAndCarbonCalc.haulageEmissionCo2.toFixed(3)} tCO2e`,
      `REDUKSI BERSIH NET   : ${qcAndCarbonCalc.netCo2Reduction.toFixed(3)} tCO2e`,
      `Valuasi Indeks Karbon: ${formatRupiah(qcAndCarbonCalc.carbonEconomicValueIdr)}`,
      '--------------------------------------------------------------------------------',
      `Simulasi Digest Hash : ${certHash} (Prototipe FNV Deterministik)`,
      `Tanggal Penerbitan   : ${new Date().toISOString()}`,
      '================================================================================',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Sertifikat_Scope3_${activePoNumber.replace('#', '')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    appendAuditLog(
      `TERBIT_SERTIFIKAT_KARBON_SCOPE3 (${qcAndCarbonCalc.netCo2Reduction.toFixed(2)} tCO2e | ${activePoNumber})`
    );
    triggerToast('Sertifikat Karbon Scope-3 (ISO 14064-1 & GRI 306) berhasil diunduh.');
  };

  const handleToggleErpConnector = (id: string) => {
    if (isReadOnlyAuditor) {
      triggerToast('Mode Auditor KLHK bersifat Read-Only: konfigurasi webhook ERP dikunci.');
      return;
    }
    const target = erpConnectors.find((c) => c.id === id);
    if (!target) return;
    const nextState = !target.connected;
    setErpConnectors((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              connected: nextState,
              lastError: null,
              lastSync: nextState ? 'Baru saja terhubung (HTTP 200 OK)' : 'Terputus oleh Administrator',
            }
          : c
      )
    );
    appendAuditLog(
      `${nextState ? 'ENABLE' : 'DISABLE'}_ERP_WEBHOOK (${target.name})`,
      nextState ? 'SYNCED' : 'VERIFIED'
    );
  };

  const handleTestErpWebhook = (id: string) => {
    setErpConnectors((prev) =>
      prev.map((c) => (c.id === id ? { ...c, testing: true, lastError: null } : c))
    );
    window.setTimeout(() => {
      setErpConnectors((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          if (!c.connected) {
            return {
              ...c,
              testing: false,
              lastError: 'Koneksi belum aktif. Aktifkan sakelar integrasi terlebih dahulu.',
            };
          }
          return {
            ...c,
            testing: false,
            lastError: null,
            lastSync: `Payload ${activePoNumber} sukses (HTTP 200 OK, 142ms)`,
          };
        })
      );
      appendAuditLog(`TEST_WEBHOOK_PAYLOAD (${id.toUpperCase()} | ${activePoNumber})`, 'SYNCED');
    }, 650);
  };

  const displayedMarkdown = useMemo(() => {
    if (mdSectionFilter === 'ALL') return MASTER_BLUEPRINT_MD;
    const sections = MASTER_BLUEPRINT_MD.split('---');
    if (mdSectionFilter === 'MATH') return sections[1]?.trim() ?? MASTER_BLUEPRINT_MD;
    if (mdSectionFilter === 'SQL') return sections[2]?.trim() ?? MASTER_BLUEPRINT_MD;
    return sections[3]?.trim() ?? MASTER_BLUEPRINT_MD;
  }, [mdSectionFilter]);

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(MASTER_BLUEPRINT_MD);
      setCopiedMd(true);
      window.setTimeout(() => setCopiedMd(false), 2500);
      triggerToast('Seluruh spesifikasi Markdown berhasil disalin ke clipboard.');
    } catch {
      triggerToast('Gagal menyalin otomatis. Gunakan tombol Download .MD File.');
    }
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([MASTER_BLUEPRINT_MD], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'symbioflow_enterprise_v4_0_master_blueprint.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    triggerToast('File symbioflow_enterprise_v4_0_master_blueprint.md berhasil diunduh.');
  };

  const unreadNotifCount = notifications.filter((n) => n.unread).length;

  return (
    <div className="min-h-dvh bg-[#0B131E] text-slate-50 flex flex-col font-sans">
      {/* 1. TOP LIVE CIRCULAR COMMODITY INDEX TICKER BAR */}
      <div className="bg-[#070D17] border-b border-slate-800 px-3 sm:px-6 py-2">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Globe className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            <span className="text-[11px] font-semibold tracking-wide text-emerald-400 uppercase">
              Indeks Spot Sirkular
            </span>
          </div>

          <div className="min-w-0 flex-1 flex items-center gap-3 overflow-x-auto py-0.5">
            {tickers.map((item) => {
              const positive = item.deltaPct >= 0;
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    if (item.linkedMaterialId) {
                      const found = MATERIALS.find((m) => m.id === item.linkedMaterialId);
                      if (found) handleSelectMaterial(found);
                      setActiveTab('marketplace');
                    } else {
                      setActiveTab('tenders');
                    }
                  }}
                  className="shrink-0 flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900/90 border border-slate-700 hover:border-emerald-400/70 transition text-left"
                >
                  <span className="font-mono text-xs font-semibold text-slate-100">{item.code}</span>
                  <span className="text-xs text-slate-300 hidden md:inline">({item.label}):</span>
                  <span className="font-mono text-xs text-slate-100">
                    {formatRupiah(item.priceIdr)}
                    {item.unit}
                  </span>
                  <span
                    className={`font-mono text-xs font-semibold flex items-center gap-0.5 ${
                      positive ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {positive ? (
                      <TrendingUp className="w-3 h-3" aria-hidden="true" />
                    ) : (
                      <TrendingDown className="w-3 h-3" aria-hidden="true" />
                    )}
                    {positive ? `+${item.deltaPct}%` : `${item.deltaPct}%`}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={refreshSpotTickers}
            title="Perbarui Harga Spot Komoditas"
            className="shrink-0 min-h-[34px] px-2.5 py-1 rounded-md bg-slate-900 border border-slate-500 text-xs text-slate-200 hover:border-cyan-400 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
            <span className="hidden sm:inline">Update Spot</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN STICKY NAVIGATION BAR */}
      <header className="sticky top-0 z-30 bg-[#0B131E]/95 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('workflow')}
              className="flex items-center gap-2.5 text-left min-h-[44px]"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-400/60 flex items-center justify-center shrink-0">
                <Factory className="w-5 h-5 text-emerald-400" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold tracking-tight text-base sm:text-lg text-slate-50">
                    SYMBIOFLOW
                  </span>
                  <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500 text-slate-950">
                    v4.0 BUSINESS
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  Circular Marketplace, 3D Digital Twin &amp; Net-60 Trade Finance
                </p>
              </div>
            </button>
          </div>

          {/* Desktop 7 Interactive Navigation Tabs */}
          <nav aria-label="Navigasi Utama SymbioFlow" className="hidden xl:flex items-center gap-1">
            {NAV_TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold transition border ${
                    active
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-slate-900/80 text-slate-200 border-slate-700 hover:border-emerald-400/60 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2">
            {/* Mobile / Tablet Accessible Menu Button */}
            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-expanded={mobileNavOpen}
              className="xl:hidden min-h-[44px] px-3 py-2 rounded-lg bg-slate-900 border border-slate-500 text-xs font-semibold text-slate-100 flex items-center gap-1.5"
            >
              <Menu className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              <span>Modul ({NAV_TABS.findIndex((t) => t.id === activeTab) + 1}/7)</span>
            </button>

            {/* Ctrl+K Command Palette Trigger */}
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="min-h-[44px] px-3 py-2 rounded-lg bg-slate-900 border border-slate-500 hover:border-cyan-400 text-xs text-slate-200 flex items-center gap-2 transition"
              aria-label="Buka Command Palette (Ctrl+K)"
            >
              <Search className="w-4 h-4 text-cyan-400" aria-hidden="true" />
              <span className="hidden md:inline">Cari Komoditas / Modul</span>
              <kbd className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-cyan-300">
                Ctrl+K
              </kbd>
            </button>

            {/* Notification Center Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                aria-expanded={notifOpen}
                aria-label={`Notifikasi (${unreadNotifCount} belum dibaca)`}
                className="min-h-[44px] min-w-[44px] px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-500 hover:border-emerald-400 flex items-center justify-center relative"
              >
                <Bell className="w-4 h-4 text-slate-200" aria-hidden="true" />
                {unreadNotifCount > 0 && (
                  <span className="ml-1 font-mono text-[11px] font-bold px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-slate-900 border border-slate-600 shadow-2xl p-3 z-40">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                    <span className="text-xs font-semibold text-slate-100">
                      Pusat Notifikasi Transaksi
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
                        }
                        className="text-xs text-cyan-400 hover:underline"
                      >
                        Tandai Dibaca
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotifications([])}
                        className="text-xs text-slate-400 hover:text-slate-200"
                      >
                        Bersihkan
                      </button>
                    </div>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center">
                      <p className="text-xs text-slate-300 mb-2">
                        Tidak ada notifikasi baru saat ini.
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setNotifications([
                            {
                              id: `n-restore-${Date.now()}`,
                              title: 'Telemetri Pasar Aktif',
                              detail: 'Pantau 3 komoditas sirkular siap kontrak di Bursa.',
                              time: 'Baru saja',
                              unread: true,
                              targetTab: 'marketplace',
                            },
                          ])
                        }
                        className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-500 text-xs text-emerald-300"
                      >
                        Muat Ulang Ringkasan Pasar
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            setNotifications((prev) =>
                              prev.map((item) =>
                                item.id === n.id ? { ...item, unread: false } : item
                              )
                            );
                            setActiveTab(n.targetTab);
                            setNotifOpen(false);
                          }}
                          className={`w-full text-left p-2.5 rounded-lg border transition ${
                            n.unread
                              ? 'bg-slate-800/90 border-emerald-500/50'
                              : 'bg-slate-950/60 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-100">{n.title}</span>
                            <span className="font-mono text-[10px] text-slate-400 shrink-0">
                              {n.time}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-1">{n.detail}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Active Corporate Profile Switcher Button */}
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="min-h-[44px] px-3 py-1.5 rounded-lg bg-slate-900 border border-emerald-500/70 hover:border-emerald-400 text-left flex items-center gap-2.5 transition"
            >
              <Building2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-100 max-w-[175px] truncate">
                    {activeAccount.companyName}
                  </span>
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-500/60 text-[10px] font-semibold text-emerald-300">
                    <CheckCircle2 className="w-2.5 h-2.5" aria-hidden="true" />
                    KYB
                  </span>
                </div>
                <span className="block text-[11px] text-slate-300">{activeAccount.roleLabel}</span>
              </div>
              <span className="sm:hidden text-xs font-semibold text-emerald-300">Akun KYB</span>
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Reflow Navigation Drawer */}
        {mobileNavOpen && (
          <div className="xl:hidden border-t border-slate-800 bg-[#070D17] px-4 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {NAV_TABS.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      setMobileNavOpen(false);
                    }}
                    className={`min-h-[44px] px-3.5 py-2.5 rounded-lg text-left border flex items-center justify-between ${
                      active
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-semibold'
                        : 'bg-slate-900 text-slate-100 border-slate-700'
                    }`}
                  >
                    <span className="text-xs font-semibold">{tab.label}</span>
                    <span
                      className={`text-[11px] ${active ? 'text-slate-900' : 'text-slate-400'}`}
                    >
                      {tab.shortDesc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* 3. SUB-HEADER REAL-TIME TELEMETRY BAR */}
      <div className="bg-[#070D17]/95 border-b border-slate-800 px-3 sm:px-6 py-2.5">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
              <span className="text-slate-400">KLHK Status:</span>
              <span className="font-semibold text-emerald-300">{activeAccount.klhkStatus}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">NIB 13-Digit:</span>
              <span className="font-mono font-semibold text-slate-100">{activeAccount.nib}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-cyan-400 shrink-0" aria-hidden="true" />
              <span className="text-slate-400">Limit Net-60:</span>
              <span className="font-mono font-semibold text-cyan-300">
                {formatRupiah(activeAccount.creditLimitIdr)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Saldo Escrow VA:</span>
              <span className="font-mono font-semibold text-emerald-300">
                {formatRupiah(activeAccount.escrowBalanceIdr)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
              <span className="text-slate-400">API Uptime:</span>
              <span className="font-mono font-semibold text-emerald-400">99.99%</span>
            </div>
          </div>

          {/* Transparent UI State Verifier (Ready / Loading / Empty / Error) */}
          <div className="flex items-center gap-2">
            <label htmlFor="ui-state-select" className="text-slate-400 text-[11px]">
              Status Data:
            </label>
            <select
              id="ui-state-select"
              value={dataViewState}
              onChange={(e) => setDataViewState(e.target.value as DataViewState)}
              className="min-h-[34px] px-2 py-1 rounded bg-slate-900 border border-slate-500 text-xs text-slate-100"
            >
              <option value="ready">Operasional Aktif</option>
              <option value="loading">Simulasi Memuat Data</option>
              <option value="empty">Simulasi Data Kosong</option>
              <option value="error">Simulasi Gangguan Jaringan</option>
            </select>
          </div>
        </div>
      </div>

      {/* Prototype Simulation Notice Banner */}
      <div className="bg-slate-900/95 border-b border-cyan-500/30 px-4 py-1.5 text-[11px] text-slate-300">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-2">
          <span>
            <strong className="text-cyan-300">Demo - data dan transaksi bersifat simulasi.</strong>{' '}
            Seluruh bursa material, lelang RFQ, webhook ERP, dan log audit berjalan sebagai prototipe sisi klien di browser.
          </span>
        </div>
      </div>

      {/* Auditor Read-Only Notice Banner */}
      {isReadOnlyAuditor && (
        <div className="bg-amber-950/60 border-b border-amber-500/50 px-4 py-2 text-xs text-amber-200">
          <div className="max-w-[1440px] mx-auto flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <span>
              Anda masuk sebagai <strong>{activeAccount.personName}</strong> ({activeAccount.companyName}
              ). Mode inspeksi regulasi mengizinkan simulasi kalkulator &amp; unduh sertifikat audit, namun mengunci mutasi finansial.
            </span>
          </div>
        </div>
      )}

      {/* MAIN WORKSPACE CONTENT */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-6 py-5 sm:py-7">
        {dataViewState === 'loading' ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl bg-slate-900/90 border border-slate-800 p-8 sm:p-12 text-center max-w-xl mx-auto my-8"
          >
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-100">
              Menyinkronkan Buku Besar Sirkular &amp; Telemetri Jembatan Timbang
            </h2>
            <p className="text-sm text-slate-300 mt-1.5">
              Mengambil vektor kimia COA Sucofindo, kuota plafon Net-60, dan status webhook SAP S/4HANA...
            </p>
            <button
              type="button"
              onClick={() => setDataViewState('ready')}
              className="mt-5 min-h-[44px] px-4 py-2 rounded-lg bg-cyan-400 text-slate-950 font-semibold text-xs"
            >
              Tampilkan Data Sekarang
            </button>
          </div>
        ) : dataViewState === 'empty' ? (
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-8 sm:p-12 text-center max-w-xl mx-auto my-8">
            <Package className="w-8 h-8 text-emerald-400 mx-auto mb-3" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-100">
              Belum Ada Batch Komoditas pada Filter Ini
            </h2>
            <p className="text-sm text-slate-300 mt-1.5">
               Ruang kerja sedang menampilkan kondisi kosong. Muat katalog produksi untuk menginspeksi batch Cangkang Sawit, Silika Sekam Padi, dan Fly Ash Kelas F.
            </p>
            <button
              type="button"
              onClick={() => setDataViewState('ready')}
              className="mt-5 min-h-[44px] px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs inline-flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Muat Katalog &amp; Kontrak Aktif</span>
            </button>
          </div>
        ) : dataViewState === 'error' ? (
          <div
            role="alert"
            className="rounded-xl bg-rose-950/40 border border-rose-500/60 p-8 sm:p-12 text-center max-w-xl mx-auto my-8"
          >
            <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-3" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-50">
              Koneksi ke Gateway SIMPEL-KLHK &amp; Escrow Terputus Sementara
            </h2>
            <p className="text-sm text-slate-200 mt-1.5">
              Permintaan sinkronisasi melebihi batas waktu 5.000 ms. Dana Smart Escrow tetap aman pada rekening Virtual Account terpisah.
            </p>
            <button
              type="button"
              onClick={() => {
                setDataViewState('ready');
                triggerToast('Koneksi gateway dipulihkan. Seluruh modul aktif kembali.');
              }}
              className="mt-5 min-h-[44px] px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>Hubungkan Ulang Gateway</span>
            </button>
          </div>
        ) : (
          <>
            {/* TAB 1: 1. WORKFLOW (7-STAGE END-TO-END INTERACTIVE SIMULATOR) */}
            {activeTab === 'workflow' && (
              <section aria-labelledby="heading-workflow" className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
                  <div>
                    <h1
                      id="heading-workflow"
                      className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight"
                    >
                      Alur Kerja Operasional SymbioFlow End-to-End (7 Tahap)
                    </h1>
                    <p className="text-sm text-slate-300 mt-1">
                      Klik salah satu tahapan untuk menjalankan simulasi verifikasi KYB, ekstraksi COA laboratorium, inspeksi 3D, hingga pencairan Smart Escrow.
                    </p>
                  </div>
                  <div className="font-mono text-xs px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-700 text-cyan-300">
                    PO Aktif: {activePoNumber} | Tahap {workflowStep}/7
                  </div>
                </div>

                {/* 7-Step Horizontal / Responsive Stepper */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
                  {WORKFLOW_STEPS.map((item) => {
                    const isCurrent = workflowStep === item.step;
                    const isCompleted = item.step < workflowStep;
                    return (
                      <button
                        key={item.step}
                        type="button"
                        onClick={() => setWorkflowStep(item.step)}
                        className={`min-h-[68px] p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                          isCurrent
                            ? 'bg-emerald-950/80 border-emerald-400 text-slate-50'
                            : isCompleted
                              ? 'bg-slate-900/90 border-emerald-500/40 text-slate-200'
                              : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                              isCurrent
                                ? 'bg-emerald-400 text-slate-950'
                                : isCompleted
                                  ? 'bg-emerald-900 text-emerald-300'
                                  : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            0{item.step}
                          </span>
                          {isCompleted && (
                            <CheckCircle2
                              className="w-4 h-4 text-emerald-400 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <span className="text-xs font-semibold leading-snug mt-2 line-clamp-2">
                          {item.title}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Active Step Detail Card + Live 3D Digital Twin */}
                {(() => {
                  const currentStepObj = WORKFLOW_STEPS[workflowStep - 1];
                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      <div className="lg:col-span-6 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-5 sm:p-6 space-y-5">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-4">
                          <div>
                            <span className="font-mono text-xs text-cyan-400 font-semibold">
                              TAHAP 0{currentStepObj.step} / 07 • {currentStepObj.department}
                            </span>
                            <h2 className="text-lg sm:text-xl font-bold text-slate-50 mt-1">
                              {currentStepObj.title}
                            </h2>
                          </div>
                        </div>

                        <p className="text-sm text-slate-200 leading-relaxed">
                          {currentStepObj.summary}
                        </p>

                        <div className="p-3.5 rounded-lg bg-slate-950/90 border border-slate-800">
                          <span className="text-xs text-slate-400 block">Output Terukur:</span>
                          <span className="text-sm font-semibold text-emerald-300 mt-0.5 block">
                            {currentStepObj.deliverable}
                          </span>
                        </div>

                        {/* Interactive AI Lab Scanner Simulator Bar (Always accessible on Step 2 or via button) */}
                        <div className="p-4 rounded-xl bg-[#070D17] border border-slate-700 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <FileCheck2 className="w-4 h-4 text-cyan-400" aria-hidden="true" />
                              <span className="text-xs font-semibold text-slate-100">
                                AI Lab Scanner: {selectedMaterial.coaDocName}
                              </span>
                            </div>
                            <span className="font-mono text-xs font-bold text-emerald-400">
                              {scanProgress}%
                            </span>
                          </div>
                          <div
                            className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden"
                            role="progressbar"
                            aria-valuenow={scanProgress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <div
                              className="h-full bg-emerald-400 transition-all duration-100"
                              style={{ width: `${scanProgress}%` }}
                            />
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                            <div className="p-2 rounded bg-slate-900 border border-slate-800">
                              <span className="text-slate-400 block text-[10px]">CAS NUMBER</span>
                              <span className="font-mono text-slate-100 font-semibold">
                                {scanProgress >= 30 ? selectedMaterial.casNumber : '---'}
                              </span>
                            </div>
                            <div className="p-2 rounded bg-slate-900 border border-slate-800">
                              <span className="text-slate-400 block text-[10px]">MOISTURE KONTRAK</span>
                              <span className="font-mono text-emerald-300 font-semibold">
                                {scanProgress >= 55 ? `${selectedMaterial.contractMoisturePct}%` : '---'}
                              </span>
                            </div>
                            <div className="p-2 rounded bg-slate-900 border border-slate-800">
                              <span className="text-slate-400 block text-[10px]">ASH CONTENT</span>
                              <span className="font-mono text-slate-100 font-semibold">
                                {scanProgress >= 80 ? `${selectedMaterial.ashContentPct}%` : '---'}
                              </span>
                            </div>
                            <div className="p-2 rounded bg-slate-900 border border-slate-800">
                              <span className="text-slate-400 block text-[10px]">VEKTOR MATCH</span>
                              <span className="font-mono text-cyan-300 font-semibold">
                                {scanProgress === 100 ? `${selectedMaterial.matchPct}%` : 'Scanning...'}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={startAiLabScanner}
                              className="min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-500 hover:border-cyan-400 text-xs font-semibold text-cyan-300 flex items-center gap-1.5"
                            >
                              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Ulangi Scan PDF Sucofindo (0% - 100%)</span>
                            </button>
                          </div>
                        </div>

                        {/* Step Action CTA & Prev/Next Controls */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={workflowStep === 1}
                              onClick={() => setWorkflowStep((s) => Math.max(1, s - 1))}
                              className="min-h-[44px] px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-600 text-xs font-semibold text-slate-200 disabled:opacity-40"
                            >
                              Tahap Sebelumnya
                            </button>
                            <button
                              type="button"
                              disabled={workflowStep === 7}
                              onClick={() => setWorkflowStep((s) => Math.min(7, s + 1))}
                              className="min-h-[44px] px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-600 text-xs font-semibold text-slate-200 disabled:opacity-40"
                            >
                              Tahap Berikutnya
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (workflowStep === 1) setAuthModalOpen(true);
                              else if (workflowStep === 2) startAiLabScanner();
                              else if (workflowStep === 3) {
                                setThermalXray(true);
                                setExploded(true);
                                triggerToast('Mode Thermal X-Ray & Exploded View (1.85x) diaktifkan pada panel 3D.');
                              } else if (workflowStep === 4) setActiveTab('tenders');
                              else if (workflowStep === 5) setActiveTab('dealroom');
                              else if (workflowStep === 6) setActiveTab('qcesg');
                              else setActiveTab('business');
                            }}
                            className="min-h-[44px] px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center gap-2 transition"
                          >
                            <span>{currentStepObj.ctaLabel}</span>
                            <ChevronRight className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      <div className="lg:col-span-6">
                        <ThreeDigitalTwin
                          material={selectedMaterial}
                          sceneMode={sceneMode}
                          onSceneModeChange={setSceneMode}
                          wireframe={wireframe}
                          onToggleWireframe={() => setWireframe((w) => !w)}
                          thermalXray={thermalXray}
                          onToggleThermal={() => setThermalXray((t) => !t)}
                          exploded={exploded}
                          onToggleExploded={() => setExploded((ex) => !ex)}
                          moistureDisplayPct={actualMoisturePct}
                        />
                      </div>
                    </div>
                  );
                })()}
              </section>
            )}

            {/* TAB 2: 2. 3D & BURSA (AI MATERIAL MARKETPLACE & CONTRACT SIMULATOR) */}
            {activeTab === 'marketplace' && (
              <section aria-labelledby="heading-bursa" className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
                  <div>
                    <h1
                      id="heading-bursa"
                      className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight"
                    >
                      Bursa Komoditas Sirkular AI, Inspektor 3D &amp; Simulator Kontrak
                    </h1>
                    <p className="text-sm text-slate-300 mt-1">
                      Pilih produk samping industri terverifikasi laboratorium, inspeksi struktur partikel maupun kontainer 20ft FIBC, lalu kunci Smart Escrow atau ajukan Counter-Offer.
                    </p>
                  </div>
                  <div className="relative w-full md:w-72">
                    <Filter
                      className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      value={catalogQuery}
                      onChange={(e) => setCatalogQuery(e.target.value)}
                      placeholder="Filter nama, kode, CAS, kota..."
                      aria-label="Filter katalog komoditas"
                      className="w-full min-h-[42px] pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-500 text-xs text-slate-100 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Catalog + Verified Lab COA Spec Card */}
                  <div className="lg:col-span-5 space-y-4">
                    {filteredMaterials.length === 0 ? (
                      <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-6 text-center">
                        <p className="text-sm text-slate-200 font-semibold">
                          Tidak ditemukan material untuk kata kunci &ldquo;{catalogQuery}&rdquo;
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Coba kata kunci seperti PKS, Silika, Fly Ash, atau nomor CAS.
                        </p>
                        <button
                          type="button"
                          onClick={() => setCatalogQuery('')}
                          className="mt-4 min-h-[40px] px-3.5 py-2 rounded-lg bg-emerald-500 text-slate-950 text-xs font-semibold"
                        >
                          Reset Filter Katalog
                        </button>
                      </div>
                    ) : (
                      filteredMaterials.map((mat) => {
                        const isSelected = mat.id === selectedMaterial.id;
                        return (
                          <button
                            key={mat.id}
                            type="button"
                            onClick={() => handleSelectMaterial(mat)}
                            className={`w-full text-left rounded-xl p-4 sm:p-5 backdrop-blur-xl border transition ${
                              isSelected
                                ? 'bg-slate-900/95 border-emerald-400 ring-1 ring-emerald-400/50'
                                : 'bg-slate-900/90 border-slate-800 hover:border-slate-600'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-200">
                                {mat.code} • CAS {mat.casNumber}
                              </span>
                              <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/60 text-cyan-300">
                                AI Vector Match {mat.matchPct}%
                              </span>
                            </div>

                            <h2 className="text-base font-bold text-slate-50 mt-2.5">{mat.name}</h2>
                            <p className="text-xs text-slate-300 mt-1">
                              {mat.supplierName} • {mat.originCity}
                            </p>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3.5 pt-3 border-t border-slate-800 text-xs">
                              <div>
                                <span className="text-slate-400 block text-[10px]">HARGA DASAR</span>
                                <span className="font-mono font-bold text-emerald-400">
                                  {formatRupiah(mat.pricePerTon)}/t
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">STOK SIAP</span>
                                <span className="font-mono font-semibold text-slate-100">
                                  {mat.availableTons.toLocaleString('id-ID')} Ton
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">MOISTURE</span>
                                <span className="font-mono font-semibold text-slate-100">
                                  {mat.contractMoisturePct}%
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">SPESIFIKASI UTAMA</span>
                                <span className="font-mono font-semibold text-cyan-300">
                                  {mat.keyMetricValue}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}

                    {/* Verified Lab COA Specification Card */}
                    <div className="rounded-xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-5 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <FileCheck2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                          <h3 className="text-sm font-bold text-slate-100">
                            Verified Lab COA Specification
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setInspectedAttachment({
                              fileName: selectedMaterial.coaDocName,
                              labIssuer: 'PT Sucofindo / SGS Industrial Testing (ISO 17025)',
                              hash: computeDeterministicHash(selectedMaterial.coaDocName),
                              summary: `${selectedMaterial.keyMetricLabel}: ${selectedMaterial.keyMetricValue} | Moisture Kontrak: ${selectedMaterial.contractMoisturePct}% | Ash Content: ${selectedMaterial.ashContentPct}% | Bulk Density: ${selectedMaterial.bulkDensity} | Status: ${selectedMaterial.tclpStatus}`,
                            })
                          }
                          className="min-h-[36px] px-2.5 py-1 rounded bg-slate-950 border border-slate-500 text-xs text-cyan-300 hover:border-cyan-400"
                        >
                          Buka PDF COA
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800">
                          <span className="text-slate-400 block">{selectedMaterial.keyMetricLabel}</span>
                          <span className="font-mono text-sm font-bold text-emerald-400 mt-0.5 block">
                            {selectedMaterial.keyMetricValue}
                          </span>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800">
                          <span className="text-slate-400 block">Batas Moisture Kontrak</span>
                          <span className="font-mono text-sm font-bold text-slate-100 mt-0.5 block">
                            {selectedMaterial.contractMoisturePct}% (AR)
                          </span>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800">
                          <span className="text-slate-400 block">Kadar Abu (Ash Content)</span>
                          <span className="font-mono text-sm font-bold text-slate-100 mt-0.5 block">
                            {selectedMaterial.ashContentPct}%
                          </span>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800">
                          <span className="text-slate-400 block">Bulk Density &amp; Faktor CO2</span>
                          <span className="font-mono text-sm font-bold text-cyan-300 mt-0.5 block">
                            {selectedMaterial.bulkDensity} • {selectedMaterial.co2FactorPerTon} tCO2e/t
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 pt-1">
                        Kepatuhan Regulasi: <strong className="text-emerald-300">{selectedMaterial.tclpStatus}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Live 3D Inspector + Contract & B2B Financing Simulator */}
                  <div className="lg:col-span-7 space-y-5">
                    <ThreeDigitalTwin
                      material={selectedMaterial}
                      sceneMode={sceneMode}
                      onSceneModeChange={setSceneMode}
                      wireframe={wireframe}
                      onToggleWireframe={() => setWireframe((w) => !w)}
                      thermalXray={thermalXray}
                      onToggleThermal={() => setThermalXray((t) => !t)}
                      exploded={exploded}
                      onToggleExploded={() => setExploded((ex) => !ex)}
                      moistureDisplayPct={selectedMaterial.contractMoisturePct}
                      compact
                    />

                    {/* Contract, Trade Assurance & B2B Financing Simulator */}
                    <div className="rounded-xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-5 sm:p-6 space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3.5">
                        <div className="flex items-center gap-2">
                          <Sliders className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                          <h3 className="text-base font-bold text-slate-50">
                            Simulator Kontrak, Trade Assurance &amp; Pembiayaan B2B
                          </h3>
                        </div>
                        <span className="font-mono text-xs text-cyan-300">
                          Plafon Tersedia: {formatRupiah(activeAccount.creditLimitIdr)}
                        </span>
                      </div>

                      {/* Payment Term Selector */}
                      <div>
                        <span className="text-xs font-semibold text-slate-300 block mb-2">
                          Skema Pembayaran &amp; Tempo Pembiayaan:
                        </span>
                        <div className="grid grid-cols-3 gap-2.5">
                          {(
                            [
                              { id: 'SPOT_ESCROW', label: 'SPOT ESCROW', sub: 'Biaya Tempo 0%' },
                              { id: 'NET_30', label: 'NET 30', sub: 'Bunga 1.2% / 30 Hari' },
                              { id: 'NET_60', label: 'NET 60', sub: 'Bunga 2.4% / 60 Hari' },
                            ] as { id: PaymentTerm; label: string; sub: string }[]
                          ).map((pt) => (
                            <button
                              key={pt.id}
                              type="button"
                              onClick={() => setPaymentTerm(pt.id)}
                              className={`min-h-[52px] p-2.5 rounded-lg border text-left transition ${
                                paymentTerm === pt.id
                                  ? 'bg-emerald-500 text-slate-950 border-emerald-300 font-bold'
                                  : 'bg-slate-950 text-slate-200 border-slate-600 hover:border-emerald-400'
                              }`}
                            >
                              <span className="font-mono text-xs block">{pt.label}</span>
                              <span
                                className={`text-[11px] block mt-0.5 ${
                                  paymentTerm === pt.id ? 'text-slate-900 font-medium' : 'text-slate-400'
                                }`}
                              >
                                {pt.sub}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Sliders for Order Volume & Counter-Offer Price */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-3.5 rounded-lg bg-slate-950/90 border border-slate-800">
                          <div className="flex items-center justify-between text-xs mb-2">
                            <label htmlFor="slider-volume" className="text-slate-300 font-medium">
                              Volume Pesanan (Metrik Ton)
                            </label>
                            <span className="font-mono font-bold text-emerald-400">
                              {orderTons.toLocaleString('id-ID')} Metrik Ton
                            </span>
                          </div>
                          <input
                            id="slider-volume"
                            type="range"
                            min={20}
                            max={selectedMaterial.availableTons}
                            step={10}
                            value={orderTons}
                            onChange={(e) => setOrderTons(Number(e.target.value))}
                            className="w-full cursor-pointer"
                          />
                          <div className="flex justify-between font-mono text-[11px] text-slate-400 mt-1">
                            <span>20 Ton</span>
                            <span>Maks. {selectedMaterial.availableTons} Ton</span>
                          </div>
                        </div>

                        <div className="p-3.5 rounded-lg bg-slate-950/90 border border-slate-800">
                          <div className="flex items-center justify-between text-xs mb-2">
                            <label htmlFor="slider-offer" className="text-slate-300 font-medium">
                              Harga Counter-Offer (Rp/Ton)
                            </label>
                            <span className="font-mono font-bold text-cyan-300">
                              {formatRupiah(offerPricePerTon)}/t
                            </span>
                          </div>
                          <input
                            id="slider-offer"
                            type="range"
                            min={Math.round(selectedMaterial.pricePerTon * 0.85)}
                            max={Math.round(selectedMaterial.pricePerTon * 1.1)}
                            step={5000}
                            value={offerPricePerTon}
                            onChange={(e) => setOfferPricePerTon(Number(e.target.value))}
                            className="w-full cursor-pointer"
                          />
                          <div className="flex justify-between font-mono text-[11px] text-slate-400 mt-1">
                            <span>{formatRupiah(selectedMaterial.pricePerTon * 0.85)}</span>
                            <span>Listing: {formatRupiah(selectedMaterial.pricePerTon)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Checkboxes for Cargo Insurance & Early Invoice Factoring T+0 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="min-h-[48px] p-3 rounded-lg bg-slate-950 border border-slate-600 flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={cargoInsurance}
                            onChange={(e) => setCargoInsurance(e.target.checked)}
                            className="mt-1 w-4 h-4 accent-emerald-500"
                          />
                          <span className="text-xs text-slate-200">
                            <strong className="block text-slate-100">
                              Cargo Insurance Protection (0.25%)
                            </strong>
                            Proteksi tumpahan, kontaminasi silang, &amp; kerusakan FIBC selama transit.
                          </span>
                        </label>

                        <label className="min-h-[48px] p-3 rounded-lg bg-slate-950 border border-slate-600 flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={earlyFactoring}
                            onChange={(e) => setEarlyFactoring(e.target.checked)}
                            className="mt-1 w-4 h-4 accent-cyan-400"
                          />
                          <span className="text-xs text-slate-200">
                            <strong className="block text-slate-100">
                              Seller Early Invoice Factoring T+0 (1.25%)
                            </strong>
                            Pemasok terima dana cair hari H setelah lolos timbang jembatan.
                          </span>
                        </label>
                      </div>

                      {/* Financial Summary Matrix */}
                      <div className="p-4 rounded-xl bg-[#070D17] border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400 block">Nilai Kontrak Gross</span>
                          <span className="font-mono text-sm font-bold text-slate-100 mt-0.5 block">
                            {formatRupiah(contractCalc.gross)}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">
                            Asuransi: {formatRupiah(contractCalc.insuranceFee)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Total Komitmen Pembeli</span>
                          <span className="font-mono text-sm font-bold text-cyan-300 mt-0.5 block">
                            {formatRupiah(contractCalc.buyerTotal)}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">
                            Biaya Tempo: {formatRupiah(contractCalc.financingFee)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Estimasi Cair Bersih Penjual</span>
                          <span className="font-mono text-sm font-bold text-emerald-400 mt-0.5 block">
                            {formatRupiah(contractCalc.sellerEstimatedNet)}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">
                            {earlyFactoring ? 'Cair Instan T+0' : 'Cair Sesuai Jatuh Tempo'}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          type="button"
                          onClick={handleSendCounterOffer}
                          className="flex-1 min-h-[46px] px-4 py-2.5 rounded-lg bg-slate-950 border border-cyan-400 text-cyan-300 hover:bg-cyan-950/60 font-semibold text-xs flex items-center justify-center gap-2 transition"
                        >
                          <MessageSquare className="w-4 h-4" aria-hidden="true" />
                          <span>Kirim Counter-Offer ke Deal Room</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleLockSmartEscrow}
                          className="flex-1 min-h-[46px] px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition"
                        >
                          <Lock className="w-4 h-4" aria-hidden="true" />
                          <span>Kunci Kontrak Smart Escrow</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* TAB 3: 3. TENDER & KREDIT (B2B REVERSE AUCTION & TRADE FINANCE BOARD) */}
            {activeTab === 'tenders' && (
              <section aria-labelledby="heading-tenders" className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
                  <div>
                    <h1
                      id="heading-tenders"
                      className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight"
                    >
                      Papan Lelang Terbalik (Reverse Auction RFQ) &amp; Kredit Net-60
                    </h1>
                    <p className="text-sm text-slate-300 mt-1">
                      Pemasok terverifikasi saling mengajukan penawaran harga terbaik secara transparan, didukung plafon pembiayaan modal kerja B2B.
                    </p>
                  </div>
                  <div className="w-full md:w-72">
                    <input
                      type="search"
                      value={tenderFilter}
                      onChange={(e) => setTenderFilter(e.target.value)}
                      placeholder="Cari pabrik, komoditas, lokasi..."
                      aria-label="Filter tender pengadaan"
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-slate-900 border border-slate-500 text-xs text-slate-100 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Open RFQ Tender Board */}
                  <div className="lg:col-span-7 space-y-4">
                    {filteredTenders.length === 0 ? (
                      <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-6 text-center">
                        <p className="text-sm text-slate-200 font-semibold">
                          Tidak ada tender RFQ yang cocok dengan pencarian &ldquo;{tenderFilter}&rdquo;.
                        </p>
                        <button
                          type="button"
                          onClick={() => setTenderFilter('')}
                          className="mt-3 min-h-[40px] px-3.5 py-2 rounded-lg bg-emerald-500 text-slate-950 text-xs font-semibold"
                        >
                          Tampilkan Semua Tender
                        </button>
                      </div>
                    ) : (
                      filteredTenders.map((rfq) => (
                        <div
                          key={rfq.id}
                          className="rounded-xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-5 space-y-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Gavel className="w-4 h-4 text-amber-400" aria-hidden="true" />
                              <span className="font-mono text-xs font-semibold text-slate-200">
                                {rfq.code}
                              </span>
                              <span className="text-xs text-slate-400">• {rfq.location}</span>
                            </div>
                            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold px-2.5 py-1 rounded bg-amber-950/80 border border-amber-500/60 text-amber-300">
                              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                              Sisa Waktu {formatCountdown(rfq.secondsLeft)}
                            </span>
                          </div>

                          <div>
                            <h2 className="text-base font-bold text-slate-50">{rfq.materialNeeded}</h2>
                            <p className="text-xs text-slate-300 mt-0.5">
                              Pabrik Pembeli: <strong className="text-slate-100">{rfq.buyerCompany}</strong>
                            </p>
                            <p className="text-xs text-slate-300 mt-1.5 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                              Spesifikasi Wajib: {rfq.specSummary} | Maks. Moisture:{' '}
                              <span className="font-mono font-semibold text-amber-300">
                                {rfq.maxMoisturePct}%
                              </span>
                            </p>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1 text-xs">
                            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                              <span className="text-slate-400 block text-[10px]">VOLUME KEBUTUHAN</span>
                              <span className="font-mono text-sm font-bold text-slate-100">
                                {rfq.volumeTons.toLocaleString('id-ID')} Metrik Ton
                              </span>
                            </div>
                            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                              <span className="text-slate-400 block text-[10px]">BID TERENDAH SAAT INI</span>
                              <span className="font-mono text-sm font-bold text-emerald-400">
                                {formatRupiah(rfq.lowestBidIdr)}/t
                              </span>
                            </div>
                            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 col-span-2 sm:col-span-1">
                              <span className="text-slate-400 block text-[10px]">PESERTA &amp; PEMIMPIN BID</span>
                              <span className="font-mono text-xs font-semibold text-cyan-300 block truncate">
                                {rfq.bidCount} Bid • {rfq.leadingBidder}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
                            <span className="font-mono text-xs text-slate-300">
                              Estimasi Kontrak: {formatRupiah(rfq.lowestBidIdr * rfq.volumeTons)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handlePlaceLowerBid(rfq.id)}
                              className="min-h-[44px] px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition"
                            >
                              <TrendingDown className="w-4 h-4" aria-hidden="true" />
                              <span>Ajukan Bid Lebih Rendah (-1.5%)</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Right Column: Trade Finance Summary & Publish New Tender Form */}
                  <div className="lg:col-span-5 space-y-5">
                    <div className="rounded-xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-5 space-y-4">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-cyan-400" aria-hidden="true" />
                        <h2 className="text-base font-bold text-slate-50">
                          Fasilitas B2B Trade Finance &amp; Early Factoring
                        </h2>
                      </div>

                      <div className="p-4 rounded-xl bg-[#070D17] border border-cyan-500/40 space-y-2">
                        <span className="text-xs text-slate-400 block">
                          Plafon Kredit Net-60 Aktif ({activeAccount.companyName})
                        </span>
                        <span className="font-mono text-xl font-bold text-cyan-300 block">
                          {formatRupiah(activeAccount.creditLimitIdr)}
                        </span>
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
                          <div>
                            <span className="text-slate-400 block">Suku Bunga Pembiayaan</span>
                            <span className="font-mono font-semibold text-slate-100">
                              1.2% / 30 Hari
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Status Pencairan Pemasok</span>
                            <span className="font-mono font-semibold text-emerald-400">
                              T+0 Early Payout Aktif
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Publish New RFQ Tender Form */}
                    <form
                      onSubmit={handlePublishNewTender}
                      className="rounded-xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-5 space-y-4"
                    >
                      <h3 className="text-base font-bold text-slate-50">
                        Publikasikan Tender RFQ Baru ke Bursa
                      </h3>

                      {rfqFormError && (
                        <div
                          role="alert"
                          className="p-3 rounded-lg bg-rose-950/80 border border-rose-500/70 text-xs text-rose-200 flex items-center gap-2"
                        >
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
                          <span>{rfqFormError}</span>
                        </div>
                      )}

                      <div>
                        <label
                          htmlFor="rfq-material"
                          className="block text-xs font-medium text-slate-300 mb-1"
                        >
                          Nama Komoditas Sekunder yang Dibutuhkan
                        </label>
                        <input
                          id="rfq-material"
                          type="text"
                          value={newRfqMaterial}
                          onChange={(e) => setNewRfqMaterial(e.target.value)}
                          placeholder="Contoh: Synthetic FGD Gypsum Kemurnian >= 94%"
                          className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-500 text-xs text-slate-100 placeholder:text-slate-400"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label
                            htmlFor="rfq-tons"
                            className="block text-xs font-medium text-slate-300 mb-1"
                          >
                            Volume (Ton)
                          </label>
                          <input
                            id="rfq-tons"
                            type="number"
                            min={10}
                            value={newRfqTons}
                            onChange={(e) => setNewRfqTons(e.target.value)}
                            className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-500 font-mono text-xs text-slate-100"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="rfq-price"
                            className="block text-xs font-medium text-slate-300 mb-1"
                          >
                            Pagu (Rp/Ton)
                          </label>
                          <input
                            id="rfq-price"
                            type="number"
                            min={50000}
                            step={5000}
                            value={newRfqCeilingPrice}
                            onChange={(e) => setNewRfqCeilingPrice(e.target.value)}
                            className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-500 font-mono text-xs text-slate-100"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="rfq-moist"
                            className="block text-xs font-medium text-slate-300 mb-1"
                          >
                            Maks. H2O (%)
                          </label>
                          <input
                            id="rfq-moist"
                            type="number"
                            step="0.1"
                            min={0.5}
                            max={45}
                            value={newRfqMoisture}
                            onChange={(e) => setNewRfqMoisture(e.target.value)}
                            className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-500 font-mono text-xs text-slate-100"
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="rfq-spec"
                          className="block text-xs font-medium text-slate-300 mb-1"
                        >
                          Syarat Kimia COA, Kemasan &amp; Jadwal Kirim
                        </label>
                        <textarea
                          id="rfq-spec"
                          rows={2}
                          value={newRfqSpec}
                          onChange={(e) => setNewRfqSpec(e.target.value)}
                          placeholder="Contoh: CaSO4.2H2O >= 94%, lolos uji TCLP PP 22/2021, pengiriman bertahap FIBC 1.5t"
                          className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-500 text-xs text-slate-100 placeholder:text-slate-400"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full min-h-[46px] px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition"
                      >
                        Tayangkan Tender RFQ Sekarang
                      </button>
                    </form>
                  </div>
                </div>
              </section>
            )}

            {/* TAB 4: 4. DEAL ROOM (4 OFFICIAL B2B CHANNELS & ENCRYPTED LIVE CHAT) */}
            {activeTab === 'dealroom' && (
              <section aria-labelledby="heading-dealroom" className="space-y-6">
                <div>
                  <h1
                    id="heading-dealroom"
                    className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight"
                  >
                    Deal Room B2B Terenkripsi &amp; 4 Jalur Kontak Resmi Pabrik
                  </h1>
                  <p className="text-sm text-slate-300 mt-1">
                    Seluruh komunikasi negosiasi, permintaan sampel bersegel QR, dan inspeksi gudang tercatat otomatis sebagai bukti audit kontrak Smart Escrow.
                  </p>
                </div>

                {/* Top Row: 4 Action Cards for Contacting Factory Partners */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="rounded-xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-4 flex flex-col justify-between gap-3">
                    <div>
                      <div className="w-9 h-9 rounded-lg bg-cyan-950 border border-cyan-500/60 flex items-center justify-center mb-3">
                        <Video className="w-4 h-4 text-cyan-400" aria-hidden="true" />
                      </div>
                      <h2 className="text-sm font-bold text-slate-50">
                        Video Call Inspeksi Gudang (WebRTC)
                      </h2>
                      <p className="text-xs text-slate-300 mt-1">
                        Inspeksi visual tumpukan stockpile, alat muat, dan pembacaan hygrometer gudang pemasok secara langsung.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setContactModal('video')}
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs"
                    >
                      Jadwalkan Video Inspeksi
                    </button>
                  </div>

                  <div className="rounded-xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-4 flex flex-col justify-between gap-3">
                    <div>
                      <div className="w-9 h-9 rounded-lg bg-emerald-950 border border-emerald-500/60 flex items-center justify-center mb-3">
                        <Package className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                      </div>
                      <h2 className="text-sm font-bold text-slate-50">
                        Minta Sampel Fisik (15 kg QR-Sealed)
                      </h2>
                      <p className="text-xs text-slate-300 mt-1">
                        Pesan sampel uji bakar/laboratorium seberat 15 kg dengan segel QR anti-manipulasi langsung ke pabrik Anda.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setContactModal('sample')}
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs"
                    >
                      Pesan Sampel 15 kg
                    </button>
                  </div>

                  <div className="rounded-xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-4 flex flex-col justify-between gap-3">
                    <div>
                      <div className="w-9 h-9 rounded-lg bg-emerald-950 border border-emerald-500/60 flex items-center justify-center mb-3">
                        <MessageSquare className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                      </div>
                      <h2 className="text-sm font-bold text-slate-50">
                        WhatsApp Enterprise API Bridge
                      </h2>
                      <p className="text-xs text-slate-300 mt-1">
                        Terhubung ke WhatsApp Business resmi PIC pabrik dengan sinkronisasi log percakapan otomatis ke Deal Room.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setContactModal('whatsapp')}
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-slate-950 border border-emerald-400 text-emerald-300 hover:bg-emerald-950/60 font-semibold text-xs"
                    >
                      Hubungkan WhatsApp Bridge
                    </button>
                  </div>

                  <div className="rounded-xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-4 flex flex-col justify-between gap-3">
                    <div>
                      <div className="w-9 h-9 rounded-lg bg-amber-950 border border-amber-500/60 flex items-center justify-center mb-3">
                        <Headset className="w-4 h-4 text-amber-400" aria-hidden="true" />
                      </div>
                      <h2 className="text-sm font-bold text-slate-50">
                        Dedicated Account Manager (&ge; 200 Ton)
                      </h2>
                      <p className="text-xs text-slate-300 mt-1">
                        Pendampingan spesialis komoditas senior untuk penstrukturan kontrak volume besar, LC, dan kuota Net-60.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setContactModal('manager')}
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs"
                    >
                      Panggil Spesialis Komoditas
                    </button>
                  </div>
                </div>

                {/* Bottom Row: Encrypted Real-Time B2B Deal Room Chat + Verified PIC Directory */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-8 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 overflow-hidden flex flex-col">
                    <div className="px-5 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-950/70">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                        <span className="text-sm font-bold text-slate-100">
                          Ruang Negosiasi Terenkripsi TLS 1.3 • Mitra: {selectedPicPartner}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-cyan-300">{activePoNumber}</span>
                    </div>

                    <div className="p-4 sm:p-5 space-y-3.5 max-h-[420px] overflow-y-auto">
                      {chatMessages.map((msg) => {
                        const isMine = msg.company === activeAccount.companyName;
                        return (
                          <div
                            key={msg.id}
                            className={`p-3.5 rounded-xl border max-w-2xl ${
                              msg.isCounterOffer
                                ? 'bg-cyan-950/50 border-cyan-400/70 ml-auto'
                                : isMine
                                  ? 'bg-emerald-950/40 border-emerald-500/50 ml-auto'
                                  : 'bg-slate-950/90 border-slate-800'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="font-semibold text-slate-100">
                                {msg.sender}{' '}
                                <span className="text-slate-400 font-normal">({msg.company})</span>
                              </span>
                              <span className="font-mono text-[11px] text-slate-400">
                                {msg.timestamp}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-200 mt-1.5 leading-relaxed">
                              {msg.text}
                            </p>
                            {msg.attachment && (
                              <button
                                type="button"
                                onClick={() => setInspectedAttachment(msg.attachment!)}
                                className="mt-2.5 min-h-[40px] px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 hover:border-cyan-400 flex items-center gap-2 text-xs text-cyan-300 transition"
                              >
                                <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
                                <span className="font-mono">{msg.attachment.fileName}</span>
                                <span className="text-slate-400 text-[11px]">(Klik Inspeksi COA)</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {partnerTyping && (
                        <div className="text-xs text-cyan-300 font-mono px-2">
                          Mitra {selectedPicPartner} sedang mengetik balasan...
                        </div>
                      )}
                    </div>

                    <form
                      onSubmit={handleSendChatMessage}
                      className="p-3.5 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row gap-2.5"
                    >
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Tulis pesan negosiasi spesifikasi, jadwal truk, atau klausul moisture..."
                        aria-label="Pesan negosiasi Deal Room"
                        className="flex-1 min-h-[44px] px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-500 text-xs sm:text-sm text-slate-100 placeholder:text-slate-400"
                      />
                      <button
                        type="submit"
                        className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shrink-0"
                      >
                        <Send className="w-4 h-4" aria-hidden="true" />
                        <span>Kirim Pesan</span>
                      </button>
                    </form>
                  </div>

                  {/* Verified PIC Contact Directory */}
                  <div className="lg:col-span-4 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-5 space-y-3.5">
                    <div className="flex items-center gap-2">
                      <PhoneCall className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                      <h3 className="text-sm font-bold text-slate-100">
                        Direktori PIC Korporat Terverifikasi KYB
                      </h3>
                    </div>
                    <p className="text-xs text-slate-300">
                      Pilih mitra untuk mengarahkan kanal diskusi aktif di Deal Room:
                    </p>
                    {[
                      {
                        company: 'PT Agro Sawit Lestari Tbk',
                        pic: 'Ir. Hendra Wijaya, M.T. (GM Commercial)',
                        nib: '9120300492817',
                        sla: 'Respon rata-rata 4 menit',
                      },
                      {
                        company: 'PT Padi Silika Karawang',
                        pic: 'Rina Kartika, S.T. (Head of Plant QC)',
                        nib: '8120094817261',
                        sla: 'Respon rata-rata 7 menit',
                      },
                      {
                        company: 'PT Sucofindo Lab Inspeksi Gresik',
                        pic: 'Desk Verifikasi Sertifikat COA & TCLP',
                        nib: '9120001827364',
                        sla: 'Otoritas Uji Independen',
                      },
                    ].map((dir) => {
                      const active = selectedPicPartner === dir.company;
                      return (
                        <button
                          key={dir.company}
                          type="button"
                          onClick={() => {
                            setSelectedPicPartner(dir.company);
                            triggerToast(`Kanal Deal Room diarahkan ke ${dir.company}.`);
                          }}
                          className={`w-full text-left p-3.5 rounded-lg border transition ${
                            active
                              ? 'bg-emerald-950/60 border-emerald-400'
                              : 'bg-slate-950 border-slate-800 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-100">{dir.company}</span>
                            <span className="font-mono text-[10px] text-emerald-400">KYB VALID</span>
                          </div>
                          <span className="block text-xs text-slate-300 mt-1">{dir.pic}</span>
                          <span className="block font-mono text-[11px] text-slate-400 mt-1">
                            NIB {dir.nib} • {dir.sla}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* TAB 5: 5. QC & ESG (DYNAMIC MOISTURE PENALTY, 3-WAY MATCHING & CARBON CERTIFICATE) */}
            {activeTab === 'qcesg' && (
              <section aria-labelledby="heading-qcesg" className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
                  <div>
                    <h1
                      id="heading-qcesg"
                      className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight"
                    >
                      Dynamic Moisture QC, 3-Way Invoice Matching &amp; Sertifikat Karbon Scope-3
                    </h1>
                    <p className="text-sm text-slate-300 mt-1">
                      Penyesuaian harga basis kering otomatis berdasarkan sensor jembatan timbang pabrik serta penerbitan sertifikat reduksi emisi berstandar ISO 14064-1 &amp; GRI 306.
                    </p>
                  </div>
                  <span className="font-mono text-xs px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-emerald-300">
                    Kontrak Aktif: {activePoNumber} ({orderTons} Ton {selectedMaterial.code})
                  </span>
                </div>

                {/* Automated 3-Way Matching Cards */}
                <div className="rounded-xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                      <h2 className="text-base font-bold text-slate-50">
                        Automated 3-Way Invoice Matching (SAP Ariba Standard)
                      </h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-slate-400">
                        Sinkron Terakhir: {lastThreeWayCheckTime}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setThreeWayRechecking(true);
                          window.setTimeout(() => {
                            setThreeWayRechecking(false);
                            const tNow =
                              new Date().toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              }) + ' WIB';
                            setLastThreeWayCheckTime(tNow);
                            appendAuditLog(`REVERIFY_3WAY_MATCH (${activePoNumber} | Truck B 9481 UEX)`);
                            triggerToast('Rekonsiliasi 3-Way Matching terverifikasi 100% cocok.');
                          }, 500);
                        }}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-500 hover:border-emerald-400 text-xs font-semibold text-emerald-300 flex items-center gap-1.5"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${threeWayRechecking ? 'animate-spin' : ''}`}
                          aria-hidden="true"
                        />
                        <span>Verifikasi Ulang 3-Way</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-slate-950/90 border border-emerald-500/50 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-300">
                          1. Digital Purchase Order
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          MATCHED
                        </span>
                      </div>
                      <p className="font-mono text-sm font-bold text-slate-50">{activePoNumber}</p>
                      <p className="text-xs text-slate-300">
                        Volume Kontrak: <span className="font-mono">{orderTons} Ton</span> @{' '}
                        <span className="font-mono">{formatRupiah(offerPricePerTon)}/t</span>
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/90 border border-emerald-500/50 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
                          2. Tiket Jembatan Timbang IoT
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          VERIFIED
                        </span>
                      </div>
                      <p className="font-mono text-sm font-bold text-slate-50">Truck B 9481 UEX</p>
                      <p className="text-xs text-slate-300">
                        Netto Timbang: <span className="font-mono">{orderTons}.00 Ton</span> | Sensor H2O:{' '}
                        <span className="font-mono text-amber-300">
                          {formatDecimalId(actualMoisturePct, 1)}%
                        </span>
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/90 border border-emerald-500/50 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-300">
                          3. DJP e-Faktur PPN 11%
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          VALIDATED
                        </span>
                      </div>
                      <p className="font-mono text-sm font-bold text-slate-50">
                        010.004-26.88291044
                      </p>
                      <p className="text-xs text-slate-300">
                        DPP Disetujui:{' '}
                        <span className="font-mono">
                          {formatRupiah(Math.min(qcAndCarbonCalc.vGross, qcAndCarbonCalc.vAdjusted))}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left: Dynamic Moisture Penalty Calculator */}
                  <div className="lg:col-span-7 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-5 sm:p-6 space-y-5">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3.5">
                      <div className="flex items-center gap-2">
                        <Scale className="w-4 h-4 text-amber-400" aria-hidden="true" />
                        <h2 className="text-base font-bold text-slate-50">
                          Kalkulator Penalti Moisture Basis Kering (Dry-Basis QC)
                        </h2>
                      </div>
                      <span
                        className={`font-mono text-xs px-2.5 py-1 rounded font-semibold ${
                          qcAndCarbonCalc.rBuyerRefund > 0
                            ? 'bg-amber-950 border border-amber-500/60 text-amber-300'
                            : 'bg-emerald-950 border border-emerald-500/60 text-emerald-300'
                        }`}
                      >
                        {qcAndCarbonCalc.rBuyerRefund > 0
                          ? 'PENALTI MOISTURE AKTIF'
                          : 'LOLOS TANPA PENALTI'}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <label htmlFor="slider-moisture-actual" className="text-slate-200 font-semibold">
                          Moisture Aktual di Jembatan Timbang (M_actual):
                        </label>
                        <div className="font-mono text-sm">
                          <span className="font-bold text-amber-400">
                            {formatDecimalId(actualMoisturePct, 1)}%
                          </span>
                          <span className="text-slate-400 mx-2">vs</span>
                          <span className="text-emerald-400">
                            Kontrak {selectedMaterial.contractMoisturePct}%
                          </span>
                        </div>
                      </div>
                      <input
                        id="slider-moisture-actual"
                        type="range"
                        min={0}
                        max={28}
                        step={0.1}
                        value={actualMoisturePct}
                        onChange={(e) => setActualMoisturePct(Number(e.target.value))}
                        className="w-full cursor-pointer"
                      />
                      <div className="flex justify-between font-mono text-[11px] text-slate-400">
                        <span>0.0% (Kering Oven)</span>
                        <span>Batas Kontrak: {selectedMaterial.contractMoisturePct}%</span>
                        <span>28.0% (Basah Ekstrem)</span>
                      </div>
                    </div>

                    {/* Deterministic Settlement Breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3.5 rounded-lg bg-[#070D17] border border-slate-800">
                        <span className="text-slate-400 block">
                          Nilai Kontrak Gross (V_gross = W &times; P)
                        </span>
                        <span className="font-mono text-base font-bold text-slate-100 mt-1 block">
                          {formatRupiah(qcAndCarbonCalc.vGross)}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-lg bg-[#070D17] border border-slate-800">
                        <span className="text-slate-400 block">
                          Nilai Basis Kering (V_adjusted)
                        </span>
                        <span className="font-mono text-base font-bold text-cyan-300 mt-1 block">
                          {formatRupiah(qcAndCarbonCalc.vAdjusted)}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-lg bg-amber-950/40 border border-amber-500/50">
                        <span className="text-amber-200 block">
                          Refund Otomatis ke Pembeli (R_buyer_refund)
                        </span>
                        <span className="font-mono text-base font-bold text-amber-300 mt-1 block">
                          {formatRupiah(qcAndCarbonCalc.rBuyerRefund)}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-500/50">
                        <span className="text-emerald-200 block">
                          Pencairan Bersih ke Penjual (P_seller_net)
                        </span>
                        <span className="font-mono text-base font-bold text-emerald-400 mt-1 block">
                          {formatRupiah(qcAndCarbonCalc.pSellerNet)}
                        </span>
                        <span className="font-mono text-[11px] text-slate-300 block mt-0.5">
                          Komisi 5%: {formatRupiah(qcAndCarbonCalc.platformFee)} | Factoring:{' '}
                          {formatRupiah(qcAndCarbonCalc.factoringDiscount)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (isReadOnlyAuditor) {
                          triggerToast('Mode Auditor KLHK bersifat Read-Only: eksekusi split payout dikunci.');
                          return;
                        }
                        appendAuditLog(
                          `SPLIT_PAYOUT_EXECUTED (${activePoNumber} | Refund ${formatRupiah(qcAndCarbonCalc.rBuyerRefund)} | Net Seller ${formatRupiah(qcAndCarbonCalc.pSellerNet)})`,
                          'SYNCED'
                        );
                        triggerToast(
                          `Split Payout ${activePoNumber} dieksekusi: Penjual menerima ${formatRupiah(qcAndCarbonCalc.pSellerNet)} & Refund Pembeli ${formatRupiah(qcAndCarbonCalc.rBuyerRefund)}.`
                        );
                      }}
                      className="w-full min-h-[46px] px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition"
                    >
                      Eksekusi Split Payout Smart Escrow Sekarang
                    </button>
                  </div>

                  {/* Right: Audit-Grade Scope-3 Carbon Certificate Generator */}
                  <div className="lg:col-span-5 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-5 sm:p-6 space-y-5">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3.5">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                        <h2 className="text-base font-bold text-slate-50">
                          Sertifikat Karbon Scope-3 (ISO 14064-1)
                        </h2>
                      </div>
                      <Leaf className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <label htmlFor="slider-distance" className="text-slate-300 font-medium">
                          Jarak Tempuh Truk Pengiriman (D_km):
                        </label>
                        <span className="font-mono font-bold text-cyan-300">
                          {haulDistanceKm} km
                        </span>
                      </div>
                      <input
                        id="slider-distance"
                        type="range"
                        min={15}
                        max={800}
                        step={5}
                        value={haulDistanceKm}
                        onChange={(e) => setHaulDistanceKm(Number(e.target.value))}
                        className="w-full cursor-pointer"
                      />
                      <div className="flex justify-between font-mono text-[11px] text-slate-400">
                        <span>15 km (Satu Kawasan)</span>
                        <span>800 km (Lintas Provinsi)</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#070D17] border border-emerald-500/40 space-y-2.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-300">
                          Emisi Virgin Dicegah ({orderTons}t &times; {selectedMaterial.co2FactorPerTon})
                        </span>
                        <span className="font-mono font-semibold text-emerald-300">
                          +{formatDecimalId(qcAndCarbonCalc.grossAvoidedCo2, 2)} tCO2e
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-300">
                          Deduksi Solar Logistik ({haulDistanceKm} km &times; 0.00011)
                        </span>
                        <span className="font-mono font-semibold text-rose-400">
                          -{formatDecimalId(qcAndCarbonCalc.haulageEmissionCo2, 2)} tCO2e
                        </span>
                      </div>
                      <div className="pt-2.5 border-t border-slate-800 flex justify-between items-baseline">
                        <span className="font-bold text-slate-100">
                          Reduksi Bersih (&Delta;CO2e_net)
                        </span>
                        <span className="font-mono text-lg font-bold text-emerald-400">
                          {formatDecimalId(qcAndCarbonCalc.netCo2Reduction, 2)} tCO2e
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Valuasi Ekonomi (@ Rp 98.500/tCO2e)</span>
                        <span className="font-mono text-cyan-300 font-semibold">
                          {formatRupiah(qcAndCarbonCalc.carbonEconomicValueIdr)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadCarbonCertificate}
                      className="w-full min-h-[46px] px-4 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition"
                    >
                      <Download className="w-4 h-4" aria-hidden="true" />
                      <span>Unduh Sertifikat Terverifikasi ISO 14064-1 &amp; GRI 306</span>
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* TAB 6: 6. BISNIS & ERP (UNIT ECONOMICS, SAAS TIERS, WEBHOOKS & AUDIT LOGS) */}
            {activeTab === 'business' && (
              <section aria-labelledby="heading-business" className="space-y-6">
                <div>
                  <h1
                    id="heading-business"
                    className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight"
                  >
                    Simulator Unit Ekonomi CBO, Paket SaaS, Webhook ERP &amp; Audit Log ISO 27001
                  </h1>
                  <p className="text-sm text-slate-300 mt-1">
                    Model monetisasi 4 lapis SymbioFlow beserta konektor langsung ke SAP S/4HANA MM, Oracle NetSuite, Odoo, dan DJP e-Faktur.
                  </p>
                </div>

                {/* Chief Business Officer Revenue Simulator */}
                <div className="rounded-xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-5 sm:p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-50">
                        Chief Business Officer (CBO) Revenue &amp; ARR Simulator
                      </h2>
                      <p className="text-xs text-slate-300">
                        Geser target GMV bulanan platform untuk menghitung proyeksi pendapatan bersih bulanan dan tahunan (ARR).
                      </p>
                    </div>
                    <div className="px-3.5 py-2 rounded-lg bg-emerald-950/80 border border-emerald-500/60 text-right">
                      <span className="text-[10px] text-emerald-200 block">ANNUALIZED NET REVENUE (ARR)</span>
                      <span className="font-mono text-base sm:text-lg font-bold text-emerald-400">
                        {formatRupiah(cboEconomics.annualizedArr)} / thn
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <label htmlFor="slider-gmv" className="text-slate-200 font-semibold">
                        Target Gross Merchandise Value (GMV) Bulanan Platform:
                      </label>
                      <span className="font-mono text-base font-bold text-cyan-300">
                        Rp {monthlyGmvBillion.toLocaleString('id-ID')} Miliar / bulan
                      </span>
                    </div>
                    <input
                      id="slider-gmv"
                      type="range"
                      min={10}
                      max={250}
                      step={5}
                      value={monthlyGmvBillion}
                      onChange={(e) => setMonthlyGmvBillion(Number(e.target.value))}
                      className="w-full cursor-pointer"
                    />
                    <div className="flex justify-between font-mono text-[11px] text-slate-400">
                      <span>Rp 10 Miliar / bln</span>
                      <span>Blended Net Take-Rate: {formatDecimalId(cboEconomics.blendedTakeRatePct, 2)}%</span>
                      <span>Rp 250 Miliar / bln</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                    <div className="p-3.5 rounded-lg bg-[#070D17] border border-slate-800">
                      <span className="text-slate-400 block">1. Komisi Escrow (4.5%)</span>
                      <span className="font-mono text-sm font-bold text-emerald-400 mt-1 block">
                        {formatRupiah(cboEconomics.escrowRevenue)}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-lg bg-[#070D17] border border-slate-800">
                      <span className="text-slate-400 block">2. Yield Kredit Net-60</span>
                      <span className="font-mono text-sm font-bold text-cyan-300 mt-1 block">
                        {formatRupiah(cboEconomics.tradeFinanceYield)}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-lg bg-[#070D17] border border-slate-800">
                      <span className="text-slate-400 block">
                        3. Langganan SaaS ({cboEconomics.activeEnterprisePlants} Pabrik)
                      </span>
                      <span className="font-mono text-sm font-bold text-slate-100 mt-1 block">
                        {formatRupiah(cboEconomics.saasSubscriptionRevenue)}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-lg bg-[#070D17] border border-slate-800">
                      <span className="text-slate-400 block">4. GreenFreight &amp; Asuransi</span>
                      <span className="font-mono text-sm font-bold text-slate-100 mt-1 block">
                        {formatRupiah(cboEconomics.greenFreightInsuranceRevenue)}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-lg bg-emerald-950/50 border border-emerald-400/60">
                      <span className="text-emerald-200 block font-semibold">
                        Pendapatan Bersih / Bulan
                      </span>
                      <span className="font-mono text-sm font-bold text-emerald-300 mt-1 block">
                        {formatRupiah(cboEconomics.monthlyNetRevenue)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Commercial SaaS Pricing Tiers (3 Selectable Cards) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(
                    [
                      {
                        id: 'STARTER',
                        name: 'Symbio Starter',
                        priceLabel: 'Rp 0 / bln',
                        target: 'Pemasok UKM & Koperasi Biomassa',
                        perks: [
                          'Akses katalog Bursa & lelang terbuka RFQ',
                          '1 pengguna per NIB perusahaan',
                          'Biaya layanan transaksi Spot Escrow standar',
                        ],
                      },
                      {
                        id: 'GROWTH_PRO',
                        name: 'Symbio Growth Pro',
                        priceLabel: 'Rp 6.500.000 / bln',
                        target: 'Pabrik Menengah & Pengolah Material',
                        perks: [
                          'AI Lab Scanner COA/MSDS & 3D Digital Twin penuh',
                          'Fasilitas kredit modal kerja Net-30 hingga Rp 1,5 Miliar',
                          'Laporan reduksi karbon Scope-3 bulanan otomatis',
                        ],
                      },
                      {
                        id: 'ENTERPRISE',
                        name: 'Industrial Enterprise',
                        priceLabel: 'Rp 22.000.000 / bln',
                        target: 'Grup Konglomerasi, PLTU, Semen & Baja Tbk',
                        perks: [
                          'Plafon Net-60 >= Rp 3,5 Miliar & Dedicated Account Manager',
                          'Integrasi penuh Webhook SAP S/4HANA MM & DJP e-Faktur',
                          'Audit rantai hash SHA-256 ISO 27001 & Sertifikat ISO 14064-1',
                        ],
                      },
                    ] as const
                  ).map((tier) => {
                    const active = selectedSaasTier === tier.id;
                    return (
                      <div
                        key={tier.id}
                        className={`rounded-xl p-5 backdrop-blur-xl border flex flex-col justify-between gap-4 ${
                          active
                            ? 'bg-slate-900/95 border-emerald-400 ring-1 ring-emerald-400/50'
                            : 'bg-slate-900/90 border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-base font-bold text-slate-50">{tier.name}</h3>
                            {active && (
                              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-400 text-slate-950">
                                PAKET AKTIF
                              </span>
                            )}
                          </div>
                          <p className="font-mono text-lg font-bold text-cyan-300 mt-2">
                            {tier.priceLabel}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">{tier.target}</p>
                          <ul className="mt-4 space-y-2 text-xs text-slate-200">
                            {tier.perks.map((perk) => (
                              <li key={perk} className="flex items-start gap-2">
                                <CheckCircle2
                                  className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5"
                                  aria-hidden="true"
                                />
                                <span>{perk}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSaasTier(tier.id);
                            appendAuditLog(`SELECT_SAAS_PLAN (${tier.name} | ${tier.priceLabel})`);
                            triggerToast(`Paket langganan korporat diperbarui ke ${tier.name}.`);
                          }}
                          className={`w-full min-h-[42px] px-3 py-2 rounded-lg text-xs font-bold border transition ${
                            active
                              ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                              : 'bg-slate-950 text-slate-100 border-slate-500 hover:border-emerald-400'
                          }`}
                        >
                          {active ? 'Paket Digunakan Saat Ini' : `Aktifkan ${tier.name}`}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Corporate ERP Webhook Toggles & Immutable Security Audit Logs */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-5 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <Webhook className="w-4 h-4 text-cyan-400" aria-hidden="true" />
                      <h2 className="text-base font-bold text-slate-50">
                        Integrasi Webhook ERP &amp; Pajak Host-to-Host
                      </h2>
                    </div>

                    <div className="space-y-3">
                      {erpConnectors.map((conn) => (
                        <div
                          key={conn.id}
                          className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <span className="text-xs font-bold text-slate-100 block">
                                {conn.name}
                              </span>
                              <span className="text-[11px] text-slate-400">{conn.protocol}</span>
                            </div>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={conn.connected}
                              onClick={() => handleToggleErpConnector(conn.id)}
                              className={`min-h-[36px] px-3 py-1 rounded-md font-mono text-xs font-bold border transition ${
                                conn.connected
                                  ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                                  : 'bg-slate-900 text-slate-300 border-slate-500'
                              }`}
                            >
                              {conn.connected ? 'CONNECTED' : 'OFFLINE'}
                            </button>
                          </div>
                          <p className="font-mono text-[11px] text-slate-400 truncate">
                            {conn.endpoint}
                          </p>
                          {conn.lastError && (
                            <p className="text-xs text-rose-400">{conn.lastError}</p>
                          )}
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <span className="font-mono text-[11px] text-cyan-300">
                              {conn.lastSync}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleTestErpWebhook(conn.id)}
                              className="min-h-[34px] px-2.5 py-1 rounded bg-slate-900 border border-slate-500 hover:border-cyan-400 text-[11px] text-slate-200"
                            >
                              {conn.testing ? 'Mengirim...' : 'Test Payload'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Simulated Deterministic Hash Chain Audit Logs */}
                  <div className="lg:col-span-7 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                        <h2 className="text-base font-bold text-slate-50">
                          Simulasi Log Audit Aktivitas (Digest Hash Deterministik FNV-32)
                        </h2>
                      </div>
                      <span className="font-mono text-xs text-emerald-400">
                        {auditLogs.length} Entri Simulasi
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400">
                            <th className="py-2.5 pr-3 font-medium">Waktu (UTC/WIB)</th>
                            <th className="py-2.5 pr-3 font-medium">NIB &amp; Entitas</th>
                            <th className="py-2.5 pr-3 font-medium">Aksi Tercatat</th>
                            <th className="py-2.5 pr-3 font-medium">Simulasi Digest Hash</th>
                            <th className="py-2.5 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80">
                          {auditLogs.slice(0, 8).map((log) => (
                            <tr key={log.id} className="hover:bg-slate-950/60">
                              <td className="py-2.5 pr-3 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                                {log.timestamp}
                              </td>
                              <td className="py-2.5 pr-3">
                                <span className="font-mono text-[11px] text-cyan-300 block">
                                  {log.actorNib}
                                </span>
                                <span className="text-[11px] text-slate-300">{log.company}</span>
                              </td>
                              <td className="py-2.5 pr-3 font-mono text-[11px] text-slate-100">
                                {log.eventAction}
                              </td>
                              <td className="py-2.5 pr-3 font-mono text-[11px] text-emerald-300">
                                {log.sha256Hash.slice(0, 16)}...
                              </td>
                              <td className="py-2.5">
                                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/50 text-emerald-300">
                                  {log.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* TAB 7: 7. MASTER .MD (BUILT-IN COMPLETE BLUEPRINT & SQL SCHEMA VIEWER) */}
            {activeTab === 'blueprint' && (
              <section aria-labelledby="heading-blueprint" className="space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Database className="w-5 h-5 text-emerald-400" aria-hidden="true" />
                      <h1
                        id="heading-blueprint"
                        className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight"
                      >
                        Master Blueprint Arsitektur &amp; Skema Produksi PostgreSQL
                      </h1>
                    </div>
                    <p className="text-sm text-slate-300 mt-1">
                      Dokumentasi spesifikasi lengkap termasuk ekstensi PostGIS (rute truk kawasan industri), pgvector (768-dimensi pencocokan kimia COA), serta contoh payload SAP S/4HANA.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleCopyMarkdown}
                      className="min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 border border-cyan-400 text-cyan-300 hover:bg-cyan-950/60 font-semibold text-xs flex items-center gap-2"
                    >
                      <Copy className="w-4 h-4" aria-hidden="true" />
                      <span>{copiedMd ? 'Markdown Tersalin!' : 'Copy Markdown'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadMarkdown}
                      className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" aria-hidden="true" />
                      <span>Download .MD File</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: 'ALL', label: 'Semua Spesifikasi (.MD)' },
                      { id: 'MATH', label: 'Rumus Matematika QC & Karbon' },
                      { id: 'SQL', label: 'Skema SQL PostgreSQL + PostGIS + pgvector' },
                      { id: 'WEBHOOK', label: 'Payload JSON SAP S/4HANA MM' },
                    ] as const
                  ).map((sec) => (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => setMdSectionFilter(sec.id)}
                      className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        mdSectionFilter === sec.id
                          ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                          : 'bg-slate-900 text-slate-200 border-slate-600 hover:border-cyan-400'
                      }`}
                    >
                      {sec.label}
                    </button>
                  ))}
                </div>

                <div className="rounded-xl bg-[#070D17] border border-slate-800 p-4 sm:p-6 overflow-x-auto">
                  <pre className="font-mono text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {displayedMarkdown}
                  </pre>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* CTRL+K COMMAND PALETTE MODAL */}
      {cmdOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center p-4 pt-16 sm:pt-24"
          role="dialog"
          aria-modal="true"
          aria-label="Command Palette SymbioFlow"
          onClick={() => setCmdOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-xl bg-slate-900 border border-slate-600 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3.5 border-b border-slate-800 flex items-center gap-2.5">
              <Search className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" />
              <input
                type="search"
                autoFocus
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                placeholder="Ketik modul, komoditas (PKS, Silika, Fly Ash), mode 3D, atau role..."
                className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setCmdOpen(false)}
                aria-label="Tutup Command Palette"
                className="min-h-[36px] min-w-[36px] rounded-lg bg-slate-800 border border-slate-600 flex items-center justify-center text-slate-200"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {(() => {
              const q = cmdQuery.trim().toLowerCase();
              const actions = [
                ...NAV_TABS.map((t) => ({
                  id: `nav-${t.id}`,
                  group: 'Navigasi Modul',
                  label: `${t.label}: ${t.shortDesc}`,
                  run: () => setActiveTab(t.id),
                })),
                ...MATERIALS.map((m) => ({
                  id: `mat-${m.id}`,
                  group: 'Inspeksi Komoditas Bursa',
                  label: `${m.code} • ${m.name} (${formatRupiah(m.pricePerTon)}/t)`,
                  run: () => {
                    handleSelectMaterial(m);
                    setActiveTab('marketplace');
                  },
                })),
                {
                  id: '3d-thermal',
                  group: 'Kontrol 3D WebGL',
                  label: 'Toggle Mode Thermal X-Ray (Deteksi Kantong Moisture)',
                  run: () => {
                    setThermalXray((v) => !v);
                    setActiveTab('marketplace');
                  },
                },
                {
                  id: 'act-sso',
                  group: 'Keamanan & KYB',
                  label: 'Buka Modal Corporate SSO & Ganti Role (Generator / Buyer / Auditor)',
                  run: () => setAuthModalOpen(true),
                },
              ].filter(
                (a) => !q || a.label.toLowerCase().includes(q) || a.group.toLowerCase().includes(q)
              );

              return (
                <div className="max-h-80 overflow-y-auto p-2 space-y-1">
                  {actions.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-xs text-slate-300">
                        Tidak ada perintah yang cocok dengan &ldquo;{cmdQuery}&rdquo;.
                      </p>
                      <button
                        type="button"
                        onClick={() => setCmdQuery('')}
                        className="mt-2.5 min-h-[36px] px-3 py-1 rounded bg-emerald-500 text-slate-950 text-xs font-semibold"
                      >
                        Reset Pencarian
                      </button>
                    </div>
                  ) : (
                    actions.map((act) => (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => {
                          act.run();
                          setCmdOpen(false);
                          setCmdQuery('');
                        }}
                        className="w-full min-h-[42px] px-3 py-2 rounded-lg hover:bg-slate-800 text-left flex items-center justify-between gap-2 transition"
                      >
                        <div>
                          <span className="text-[10px] font-mono uppercase text-cyan-400 block">
                            {act.group}
                          </span>
                          <span className="text-xs text-slate-100 font-medium">{act.label}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                      </button>
                    ))
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* MULTI-ROLE AUTHENTICATION & KYB VERIFICATION MODAL */}
      {authModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-kyb-title"
          onClick={() => setAuthModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-xl bg-slate-900 border border-slate-600 shadow-2xl p-5 sm:p-6 space-y-5 max-h-[90dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-400" aria-hidden="true" />
                <h2 id="modal-kyb-title" className="text-base sm:text-lg font-bold text-slate-50">
                  Corporate SSO &amp; Verifikasi KYB Multi-Role (NIB OSS + KLHK)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                aria-label="Tutup Modal SSO"
                className="min-h-[38px] min-w-[38px] rounded-lg bg-slate-800 border border-slate-500 flex items-center justify-center text-slate-200"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAuthModalTab('DemoSwitch')}
                className={`min-h-[42px] px-3 py-2 rounded-lg text-xs font-bold border ${
                  authModalTab === 'DemoSwitch'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                    : 'bg-slate-950 text-slate-200 border-slate-600'
                }`}
              >
                Tab A: Instant Demo Role Switcher
              </button>
              <button
                type="button"
                onClick={() => setAuthModalTab('RegisterKyb')}
                className={`min-h-[42px] px-3 py-2 rounded-lg text-xs font-bold border ${
                  authModalTab === 'RegisterKyb'
                    ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                    : 'bg-slate-950 text-slate-200 border-slate-600'
                }`}
              >
                Tab B: Registrasi Perusahaan Baru (KYB NIB)
              </button>
            </div>

            {authModalTab === 'DemoSwitch' ? (
              <div className="space-y-3">
                {accounts.map((acc) => {
                  const selected = acc.id === activeAccount.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        setActiveAccountId(acc.id);
                        setAuthModalOpen(false);
                        appendAuditLog(`SSO_SWITCH_ROLE (${acc.roleCode} | NIB ${acc.nib})`);
                        triggerToast(`Sesi beralih ke ${acc.personName} (${acc.companyName}).`);
                      }}
                      className={`w-full text-left p-4 rounded-xl border transition ${
                        selected
                          ? 'bg-emerald-950/60 border-emerald-400'
                          : 'bg-slate-950 border-slate-700 hover:border-emerald-400/70'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-emerald-300">{acc.roleLabel}</span>
                        <span className="font-mono text-xs text-cyan-300">NIB: {acc.nib}</span>
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-slate-100 mt-1">
                        {acc.ownerSummary}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <form onSubmit={handleRegisterKyb} className="space-y-3.5">
                {kybError && (
                  <div
                    role="alert"
                    className="p-3 rounded-lg bg-rose-950/80 border border-rose-500/70 text-xs text-rose-200 flex items-center gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
                    <span>{kybError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="kyb-company"
                      className="block text-xs font-medium text-slate-300 mb-1"
                    >
                      Nama Badan Hukum (PT / CV)
                    </label>
                    <input
                      id="kyb-company"
                      type="text"
                      value={kybCompany}
                      onChange={(e) => setKybCompany(e.target.value)}
                      placeholder="PT Krakatau Material Sirkular"
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-500 text-xs text-slate-100 placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="kyb-nib"
                      className="block text-xs font-medium text-slate-300 mb-1"
                    >
                      Nomor OSS NIB (Wajib 13 Digit)
                    </label>
                    <input
                      id="kyb-nib"
                      type="text"
                      maxLength={13}
                      value={kybNib}
                      onChange={(e) => setKybNib(e.target.value)}
                      placeholder="9120400881920"
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-500 font-mono text-xs text-slate-100 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="kyb-email"
                      className="block text-xs font-medium text-slate-300 mb-1"
                    >
                      Email Korporat Resmi
                    </label>
                    <input
                      id="kyb-email"
                      type="email"
                      value={kybEmail}
                      onChange={(e) => setKybEmail(e.target.value)}
                      placeholder="procurement@perusahaan.co.id"
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-500 text-xs text-slate-100 placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="kyb-role"
                      className="block text-xs font-medium text-slate-300 mb-1"
                    >
                      Peran Ekosistem
                    </label>
                    <select
                      id="kyb-role"
                      value={kybRole}
                      onChange={(e) => setKybRole(e.target.value as 'PRODUCER' | 'BUYER' | 'HYBRID')}
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-500 text-xs text-slate-100"
                    >
                      <option value="BUYER">Buyer (Pabrik Pemanfaat)</option>
                      <option value="PRODUCER">Generator (Penghasil Residu)</option>
                      <option value="HYBRID">Hybrid (Penghasil &amp; Pemanfaat)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="kyb-license"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Jenis Izin Lingkungan / KLHK
                  </label>
                  <select
                    id="kyb-license"
                    value={kybLicense}
                    onChange={(e) => setKybLicense(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-500 text-xs text-slate-100"
                  >
                    <option value="SIMPEL-KLHK Pemanfaatan Biomassa & Non-B3">
                      SIMPEL-KLHK Pemanfaatan Biomassa &amp; Non-B3
                    </option>
                    <option value="Izin Pemanfaatan Limbah Terdaftar PP 22/2021">
                      Izin Pemanfaatan Limbah Terdaftar PP 22/2021
                    </option>
                    <option value="Sertifikasi Co-Firing & Substitusi Klinker">
                      Sertifikasi Co-Firing &amp; Substitusi Klinker
                    </option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[46px] px-4 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs"
                >
                  Verifikasi NIB &amp; Aktifkan Plafon Net-60 Rp 2.000.000.000
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* DEAL ROOM 4 CONTACT CHANNEL MODALS */}
      {contactModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Kanal Kontak B2B SymbioFlow"
          onClick={() => setContactModal(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-slate-900 border border-slate-600 shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-50">
                {contactModal === 'video' && 'Jadwalkan Video Call Inspeksi Gudang (WebRTC)'}
                {contactModal === 'sample' && 'Pemesanan Sampel Fisik 15 kg Bersegel QR'}
                {contactModal === 'whatsapp' && 'Konfigurasi WhatsApp Enterprise API Bridge'}
                {contactModal === 'manager' && 'Penugasan Dedicated Account Manager (>= 200 Ton)'}
              </h2>
              <button
                type="button"
                onClick={() => setContactModal(null)}
                aria-label="Tutup Modal"
                className="min-h-[36px] min-w-[36px] rounded-lg bg-slate-800 border border-slate-500 flex items-center justify-center text-slate-200"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {contactModal === 'video' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label htmlFor="vid-date" className="block text-slate-300 mb-1">
                    Tanggal Inspeksi Gudang Pemasok
                  </label>
                  <input
                    id="vid-date"
                    type="date"
                    value={videoDate}
                    onChange={(e) => setVideoDate(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-500 font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="vid-slot" className="block text-slate-300 mb-1">
                    Sesi &amp; Sudut Kamera Stockpile
                  </label>
                  <select
                    id="vid-slot"
                    value={videoSlot}
                    onChange={(e) => setVideoSlot(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-500 text-slate-100"
                  >
                    <option>10:00 - 10:45 WIB (Kamera Stockpile Bay 3)</option>
                    <option>13:30 - 14:15 WIB (Area Muat FIBC &amp; Hygrometer)</option>
                    <option>15:30 - 16:15 WIB (Jembatan Timbang &amp; Lab Internal)</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setChatMessages((prev) => [
                      ...prev,
                      {
                        id: `m-vid-${Date.now()}`,
                        sender: activeAccount.personName,
                        company: activeAccount.companyName,
                        roleTag: 'Jadwal WebRTC Terkonfirmasi',
                        timestamp: 'Baru saja',
                        text: `[WEBRTC INSPEKSI GUDANG] Sesi live video dijadwalkan pada ${videoDate} pukul ${videoSlot} untuk batch ${selectedMaterial.code}.`,
                      },
                    ]);
                    appendAuditLog(`SCHEDULE_WEBRTC_INSPECTION (${videoDate} | ${selectedMaterial.code})`);
                    setContactModal(null);
                    triggerToast('Tautan ruang WebRTC Inspeksi Gudang dikirim ke Deal Room.');
                  }}
                  className="w-full min-h-[44px] rounded-lg bg-cyan-400 text-slate-950 font-bold"
                >
                  Konfirmasi Jadwal &amp; Kirim Tautan WebRTC
                </button>
              </div>
            )}

            {contactModal === 'sample' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label htmlFor="smp-addr" className="block text-slate-300 mb-1">
                    Alamat Laboratorium / Pabrik Tujuan Sampel 15 kg
                  </label>
                  <textarea
                    id="smp-addr"
                    rows={2}
                    value={sampleAddress}
                    onChange={(e) => setSampleAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-500 text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="smp-cour" className="block text-slate-300 mb-1">
                    Layanan Logistik Berantai Segel
                  </label>
                  <select
                    id="smp-cour"
                    value={sampleCourier}
                    onChange={(e) => setSampleCourier(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-500 text-slate-100"
                  >
                    <option>SymbioExpress Same-Day Industrial Cold/Dry Seal</option>
                    <option>Kargo Darat Terproteksi (Estimasi 24 Jam)</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const qrSeal = `SYM-SMP-15KG-${Math.floor(1000 + (Date.now() % 8999))}`;
                    setChatMessages((prev) => [
                      ...prev,
                      {
                        id: `m-smp-${Date.now()}`,
                        sender: activeAccount.personName,
                        company: activeAccount.companyName,
                        roleTag: 'Order Sampel Lab',
                        timestamp: 'Baru saja',
                        text: `[ORDER SAMPEL 15 KG] Segel QR: ${qrSeal} (${selectedMaterial.shortName}) dikirim via ${sampleCourier} ke: ${sampleAddress}.`,
                      },
                    ]);
                    appendAuditLog(`DISPATCH_15KG_SAMPLE (${qrSeal} | ${selectedMaterial.code})`);
                    setContactModal(null);
                    triggerToast(`Sampel 15 kg dengan segel ${qrSeal} berhasil dipesan.`);
                  }}
                  className="w-full min-h-[44px] rounded-lg bg-emerald-500 text-slate-950 font-bold"
                >
                  Terbitkan Segel QR &amp; Kirim Sampel 15 kg
                </button>
              </div>
            )}

            {contactModal === 'whatsapp' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label htmlFor="wa-num" className="block text-slate-300 mb-1">
                    Nomor WhatsApp Business Korporat Anda
                  </label>
                  <input
                    id="wa-num"
                    type="tel"
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-500 font-mono text-slate-100"
                  />
                </div>
                <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={waAutoArchive}
                    onChange={(e) => setWaAutoArchive(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500"
                  />
                  <span>Arsipkan seluruh pesan WhatsApp ke jejak audit ISO 27001 Deal Room</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setChatMessages((prev) => [
                      ...prev,
                      {
                        id: `m-wa-${Date.now()}`,
                        sender: 'WhatsApp Enterprise Bridge',
                        company: activeAccount.companyName,
                        roleTag: 'WA Business Webhook',
                        timestamp: 'Baru saja',
                        text: `[WHATSAPP BRIDGE TERHUBUNG] Nomor ${waPhone} terhubung dengan PIC ${selectedPicPartner} (Auto-Archive: ${waAutoArchive ? 'Aktif' : 'Nonaktif'}).`,
                      },
                    ]);
                    appendAuditLog(`CONNECT_WA_ENTERPRISE_BRIDGE (${waPhone})`);
                    setContactModal(null);
                    triggerToast('Jembatan WhatsApp Enterprise API berhasil diaktifkan.');
                  }}
                  className="w-full min-h-[44px] rounded-lg bg-emerald-500 text-slate-950 font-bold"
                >
                  Aktifkan Bridge &amp; Sinkronkan Percakapan
                </button>
              </div>
            )}

            {contactModal === 'manager' && (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">Spesialis Komoditas Ditugaskan:</span>
                  <span className="text-sm font-bold text-amber-300 block mt-0.5">
                    Ir. Dimas Prakoso, CFA (VP Structured Commodity Desk)
                  </span>
                  <span className="font-mono text-[11px] text-slate-300">
                    SLA Respon Korporat &lt; 15 Menit • Kontrak Volume Besar &ge; 200 Ton
                  </span>
                </div>
                <div>
                  <label htmlFor="am-note" className="block text-slate-300 mb-1">
                    Agenda Strukturisasi Kontrak / Kredit Net-60
                  </label>
                  <textarea
                    id="am-note"
                    rows={3}
                    value={amNotes}
                    onChange={(e) => setAmNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-500 text-slate-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setChatMessages((prev) => [
                      ...prev,
                      {
                        id: `m-am-${Date.now()}`,
                        sender: 'Ir. Dimas Prakoso, CFA',
                        company: 'SymbioFlow Commodity Desk',
                        roleTag: 'Dedicated Account Manager',
                        timestamp: 'Baru saja',
                        text: `Permintaan pendampingan diterima: "${amNotes}". Saya telah bergabung di Deal Room ini untuk memfasilitasi strukturisasi kontrak dan alokasi plafon Net-60.`,
                      },
                    ]);
                    appendAuditLog(`SUMMON_ACCOUNT_MANAGER (Ir. Dimas Prakoso | >=200t Desk)`);
                    setContactModal(null);
                    triggerToast('Dedicated Account Manager telah bergabung ke Deal Room.');
                  }}
                  className="w-full min-h-[44px] rounded-lg bg-amber-500 text-slate-950 font-bold"
                >
                  Undang Spesialis ke Deal Room Sekarang
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PDF COA / MSDS DOCUMENT INSPECTOR MODAL */}
      {inspectedAttachment && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Inspektor Sertifikat Laboratorium COA"
          onClick={() => setInspectedAttachment(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-slate-900 border border-cyan-500/60 shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" aria-hidden="true" />
                <span className="font-mono text-sm font-bold text-slate-100">
                  {inspectedAttachment.fileName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInspectedAttachment(null)}
                aria-label="Tutup Dokumen"
                className="min-h-[36px] min-w-[36px] rounded-lg bg-slate-800 border border-slate-500 flex items-center justify-center text-slate-200"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs">
              <div>
                <span className="text-slate-400 block">Lembaga Penerbit Sertifikat:</span>
                <span className="font-semibold text-emerald-300">
                  {inspectedAttachment.labIssuer}
                </span>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 leading-relaxed text-slate-200 font-mono">
                {inspectedAttachment.summary}
              </div>
              <div>
                <span className="text-slate-400 block">SHA-256 Document Integrity Hash:</span>
                <span className="font-mono text-[11px] text-cyan-300 break-all">
                  {inspectedAttachment.hash}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST FEEDBACK BANNER */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-50 rounded-xl bg-slate-900 border border-emerald-400 px-4 py-3 shadow-2xl flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 text-xs text-slate-100">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            aria-label="Tutup pemberitahuan"
            className="text-slate-300 hover:text-white"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* COMPACT OPERATIONAL FOOTER */}
      <footer className="border-t border-slate-800 bg-[#070D17] px-4 sm:px-6 py-4 text-xs text-slate-400">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <strong className="text-slate-200">SYMBIOFLOW ENTERPRISE v4.0</strong> • Infrastruktur Pasar Sirkular Industri, Digital Twin 3D &amp; Trade Finance B2B
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            Lingkungan Simulasi Interaktif Terverifikasi • Tekan Ctrl+K untuk Navigasi Cepat
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
