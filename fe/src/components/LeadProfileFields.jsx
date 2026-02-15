import { leadSelectOptions } from '../constants/leadForm';

export const LEAD_FIELD_SECTIONS = {
  BASICS: 'basics',
  PROFILE: 'profile',
  FINANCIAL: 'financial',
  OPERATIONS: 'operations'
};

function SelectField({ label, value, onChange, options, required = false }) {
  return (
    <label>
      {label}
      <select value={value} onChange={onChange} required={required}>
        <option value="">Select Type</option>
        {options.map((item) => (
          <option key={item} value={item}>
            {item.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    </label>
  );
}

function LeadProfileFields({ form, setForm, showOperationalFields = true, sections = null }) {
  const setValue = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const renderAll = !sections || sections.length === 0;
  const sectionSet = new Set(sections || []);
  const showSection = (section) => renderAll || sectionSet.has(section);

  return (
    <>
      {showSection(LEAD_FIELD_SECTIONS.BASICS) ? (
        <>
          <label>
            Name of the Promoter / Authorized Person
            <input value={form.promoterName} onChange={setValue('promoterName')} required />
          </label>
          <label>
            Contact Person (If Different)
            <input value={form.contactPerson} onChange={setValue('contactPerson')} />
          </label>
          <label>
            Email ID
            <input type="email" value={form.email} onChange={setValue('email')} />
          </label>
          <label>
            Phone No.
            <input value={form.mobileNumber} onChange={setValue('mobileNumber')} required />
          </label>
          <label>
            Name of the Enterprise / Business
            <input value={form.companyName} onChange={setValue('companyName')} required />
          </label>
          <SelectField
            label="Business Constitution Type"
            value={form.businessConstitutionType}
            onChange={setValue('businessConstitutionType')}
            options={leadSelectOptions.businessConstitutionType}
          />
          <SelectField
            label="Inquiry For"
            value={form.inquiryFor}
            onChange={setValue('inquiryFor')}
            options={leadSelectOptions.inquiryFor}
            required
          />
          <label>
            Expected Fees / Service Value (INR)
            <input type="number" min={0} step="0.01" value={form.expectedServiceValue} onChange={setValue('expectedServiceValue')} />
          </label>
        </>
      ) : null}

      {showSection(LEAD_FIELD_SECTIONS.PROFILE) ? (
        <>
          <label className="full-row">
            Address
            <textarea rows={2} value={form.address} onChange={setValue('address')} required />
          </label>
          <label>
            Taluka / Tehsil
            <input value={form.taluka} onChange={setValue('taluka')} />
          </label>
          <label>
            District
            <input value={form.district} onChange={setValue('district')} required />
          </label>
          <label>
            City
            <input value={form.city} onChange={setValue('city')} required />
          </label>
          <label>
            State
            <input value={form.state} onChange={setValue('state')} required />
          </label>
          <SelectField
            label="Project Land Detail"
            value={form.projectLandDetail}
            onChange={setValue('projectLandDetail')}
            options={leadSelectOptions.projectLandDetail}
          />
          <SelectField
            label="Gender of Partners / Directors"
            value={form.partnersDirectorsGender}
            onChange={setValue('partnersDirectorsGender')}
            options={leadSelectOptions.partnersDirectorsGender}
          />
          <SelectField
            label="Caste of Promoter / Partners / Entrepreneurs"
            value={form.promoterCasteCategory}
            onChange={setValue('promoterCasteCategory')}
            options={leadSelectOptions.promoterCasteCategory}
          />
          <label className="full-row">
            Manufacturing or Processing of
            <textarea rows={2} value={form.manufacturingDetails} onChange={setValue('manufacturingDetails')} />
          </label>
        </>
      ) : null}

      {showSection(LEAD_FIELD_SECTIONS.FINANCIAL) ? (
        <>
          <label>
            Investment in Building / Construction
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.investmentBuildingConstruction}
              onChange={setValue('investmentBuildingConstruction')}
            />
          </label>
          <label>
            Investment in Land
            <input type="number" min={0} step="0.01" value={form.investmentLand} onChange={setValue('investmentLand')} />
          </label>
          <label>
            Investment in Plant & Machinery
            <input type="number" min={0} step="0.01" value={form.investmentPlantMachinery} onChange={setValue('investmentPlantMachinery')} />
          </label>
          <label>
            Total Investment
            <input type="number" min={0} step="0.01" value={form.totalInvestment} onChange={setValue('totalInvestment')} />
          </label>
          <SelectField
            label="Bank Loan (If Any)"
            value={form.bankLoanIfAny}
            onChange={setValue('bankLoanIfAny')}
            options={leadSelectOptions.bankLoanIfAny}
          />
          <label>
            Bank Loan (%)
            <input type="number" min={0} max={100} step="0.01" value={form.financeBankLoanPercent} onChange={setValue('financeBankLoanPercent')} />
          </label>
          <label>
            Own Contribution / Margin (%)
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.financeOwnContributionPercent}
              onChange={setValue('financeOwnContributionPercent')}
            />
          </label>
          <SelectField
            label="What is the Type of Your Project?"
            value={form.projectType}
            onChange={setValue('projectType')}
            options={leadSelectOptions.projectType}
          />
          <SelectField
            label="Availed Any Subsidy Previously?"
            value={form.availedSubsidyPreviously}
            onChange={setValue('availedSubsidyPreviously')}
            options={leadSelectOptions.availedSubsidyPreviously}
          />
          <label className="full-row">
            Any Specific Ask or Highlight about the Project
            <textarea rows={3} value={form.projectSpecificAsk} onChange={setValue('projectSpecificAsk')} />
          </label>
        </>
      ) : null}

      {showOperationalFields && showSection(LEAD_FIELD_SECTIONS.OPERATIONS) ? (
        <>
          <SelectField label="Source of Lead" value={form.source} onChange={setValue('source')} options={leadSelectOptions.source} />
          <label>
            Associate / B2B Partner Name
            <input value={form.associatePartnerName} onChange={setValue('associatePartnerName')} />
          </label>
          <SelectField
            label="Customer Progress Status"
            value={form.customerProgressStatus}
            onChange={setValue('customerProgressStatus')}
            options={leadSelectOptions.customerProgressStatus}
          />
          <SelectField
            label="Requirement Type"
            value={form.requirementType}
            onChange={setValue('requirementType')}
            options={leadSelectOptions.requirementType}
          />
          <label>
            Industry Type
            <input value={form.industryType} onChange={setValue('industryType')} />
          </label>
          <label>
            Next Follow-up
            <input type="datetime-local" value={form.nextFollowUpAt} onChange={setValue('nextFollowUpAt')} />
          </label>
        </>
      ) : null}
    </>
  );
}

export default LeadProfileFields;
