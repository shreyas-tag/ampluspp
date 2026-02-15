import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { apiErrorMessage } from '../api/client';
import PageHeader from '../components/PageHeader';
import LeadProfileFields, { LEAD_FIELD_SECTIONS } from '../components/LeadProfileFields';
import { buildLeadPayload, leadFormInitialValues } from '../constants/leadForm';

const CREATE_LEAD_STEPS = [
  { step: 1, label: 'Basic Details', sections: [LEAD_FIELD_SECTIONS.BASICS] },
  { step: 2, label: 'Location & Profile', sections: [LEAD_FIELD_SECTIONS.PROFILE] },
  { step: 3, label: 'Financial Scope', sections: [LEAD_FIELD_SECTIONS.FINANCIAL] },
  { step: 4, label: 'Operations', sections: [LEAD_FIELD_SECTIONS.OPERATIONS] }
];

const requiredByStep = {
  1: [
    { key: 'promoterName', label: 'Promoter name' },
    { key: 'mobileNumber', label: 'Phone number' },
    { key: 'companyName', label: 'Enterprise / Business name' },
    { key: 'inquiryFor', label: 'Inquiry for' }
  ],
  2: [
    { key: 'address', label: 'Address' },
    { key: 'district', label: 'District' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' }
  ],
  3: [],
  4: []
};

function LeadCreatePage() {
  const [form, setForm] = useState(leadFormInitialValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const navigate = useNavigate();
  const isLastStep = currentStep === CREATE_LEAD_STEPS.length;

  const validateStep = (step) => {
    const requiredFields = requiredByStep[step] || [];
    const missing = requiredFields.find(({ key }) => !String(form[key] ?? '').trim());
    if (!missing) return '';
    return `${missing.label} is required before proceeding.`;
  };

  const goToNextStep = () => {
    const stepError = validateStep(currentStep);
    if (stepError) {
      setError(stepError);
      return;
    }
    setError('');
    setCurrentStep((prev) => Math.min(CREATE_LEAD_STEPS.length, prev + 1));
  };

  const goToPreviousStep = () => {
    setError('');
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const firstInvalidRequiredStep = () => {
    const orderedSteps = [1, 2];
    for (const step of orderedSteps) {
      const stepError = validateStep(step);
      if (stepError) return { step, message: stepError };
    }
    return null;
  };

  const submitLead = async (event) => {
    event.preventDefault();
    if (!isLastStep) {
      goToNextStep();
      return;
    }

    const invalidStep = firstInvalidRequiredStep();
    if (invalidStep) {
      setError(invalidStep.message);
      setCurrentStep(invalidStep.step);
      return;
    }

    setLoading(true);
    try {
      const payload = buildLeadPayload(form);
      const { data } = await api.post('/leads', payload);
      navigate(`/leads/${data.lead._id}`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="page">
      <PageHeader
        title="Create Lead"
        subtitle="Standardized intake form for accurate tracking and future analytics."
      />

      <article className="card form-card">
        <form className="grid-form" onSubmit={submitLead}>
          <div className="full-row stepper-head">
            <div className="stepper-track">
              <span className="stepper-line" />
              {CREATE_LEAD_STEPS.map((item) => (
                <div key={item.step} className="stepper-step">
                  <span className={`stepper-dot ${currentStep === item.step ? 'active' : ''} ${currentStep > item.step ? 'done' : ''}`.trim()}>
                    {item.step}
                  </span>
                  <small className={`stepper-step-label ${currentStep === item.step ? 'active' : ''}`}>{item.label}</small>
                </div>
              ))}
            </div>
          </div>

          <LeadProfileFields
            form={form}
            setForm={setForm}
            showOperationalFields
            sections={CREATE_LEAD_STEPS.find((item) => item.step === currentStep)?.sections || []}
          />

          {error ? <p className="error-text form-error">{error}</p> : null}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/leads')}>
              Cancel
            </button>
            {currentStep > 1 ? (
              <button type="button" className="btn btn-secondary" onClick={goToPreviousStep} disabled={loading}>
                Previous
              </button>
            ) : null}
            {!isLastStep ? (
              <button type="button" className="btn btn-primary" onClick={goToNextStep} disabled={loading}>
                Next
              </button>
            ) : (
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Create Lead'}
              </button>
            )}
          </div>
        </form>
      </article>
    </section>
  );
}

export default LeadCreatePage;
