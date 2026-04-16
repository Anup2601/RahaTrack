export interface AnnexureStatusDefinition {
  id: string;
  label: string;
  title: string;
  order: number;
}

export const ANNEXURE_STATUS_ITEMS: AnnexureStatusDefinition[] = [
  { id: "annexure-i", label: "Annexure-I", title: "Covering Letter for Incentive claim from Applicant", order: 1 },
  { id: "annexure-ii", label: "Annexure-II", title: "Independent Auditors' Certificate", order: 2 },
  { id: "annexure-ii-a", label: "Annexure-II-A", title: "Head-wise details of Assets (Eligible Investment)", order: 3 },
  { id: "annexure-ii-b", label: "Annexure-II-B", title: "Capex Register for Eligible Investment", order: 4 },
  { id: "annexure-ii-c", label: "Annexure-II-C", title: "Declaration for Tools, Dies, Moulds, etc. located outside the factory", order: 5 },
  { id: "annexure-ii-d", label: "Annexure-II-D", title: "Undertaking from Vendor/ Other Party with whom assets are kept", order: 6 },
  { id: "annexure-ii-e-sales-register", label: "Annexure-II-E", title: "Sales Register for Eligible Products", order: 7 },
  { id: "annexure-ii-e-statement", label: "Annexure-II-E", title: "Statement of Sales of Eligible Products", order: 8 },
  { id: "annexure-ii-f", label: "Annexure-II-F", title: "Debtors related to Eligible Products", order: 9 },
  { id: "annexure-ii-fa", label: "Annexure-II-FA", title: "Balance confirmation from Debtors", order: 10 },
  { id: "annexure-ii-g", label: "Annexure-II-G", title: "Details regarding AAT Components used in AAT Vehicles", order: 11 },
  { id: "annexure-iii", label: "Annexure-III", title: "Management Certificate for Incentive Claim", order: 12 },
  { id: "annexure-iii-a", label: "Annexure-III-A", title: "Adequacy of Insurance", order: 13 },
  { id: "annexure-iv", label: "Annexure-IV", title: "Certificate from Company Secretary", order: 14 },
  { id: "annexure-v", label: "Annexure-V", title: "Chartered Engineer's Certificate", order: 15 },
  { id: "annexure-v-a", label: "Annexure-V-A", title: "Details of Eligible Investment", order: 16 },
  { id: "annexure-v-b", label: "Annexure-V-B", title: "Building Layout Plan", order: 17 },
  { id: "annexure-v-c", label: "Annexure-V-C", title: "Photos of Site Visit", order: 18 },
  { id: "annexure-v-d", label: "Annexure-V-D", title: "Manufacturing Process", order: 19 },
  { id: "annexure-v-e", label: "Annexure-V-E", title: "Details of Insurance Cover for Eligible Investment", order: 20 },
  { id: "annexure-v-f", label: "Annexure-V-F", title: "Details of assets at premises of vendors/ other parties", order: 21 },
  { id: "annexure-vi", label: "Annexure-VI", title: "Integrity Compliance Part A (at the time of filing the claim)", order: 22 },
  { id: "annexure-vii", label: "Annexure-VII", title: "Integrity Compliance Part B (before release of incentive)", order: 23 },
  { id: "annexure-viii", label: "Annexure-VIII", title: "Deed of Indemnity cum Undertaking, to be submitted by the applicant", order: 24 },
  { id: "annexure-ix", label: "Annexure-IX", title: "Board Resolution of the Applicant", order: 25 },
  { id: "annexure-x", label: "Annexure-X", title: "Bank Mandate Form", order: 26 },
  { id: "annexure-xi", label: "Annexure-XI", title: "Management Representation Letter", order: 27 },
];

export const formatAnnexureStatusTitle = (item: AnnexureStatusDefinition) => {
  return `${item.label} ${item.title}`;
};