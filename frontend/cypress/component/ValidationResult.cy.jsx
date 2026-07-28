import ValidationResult from '../../src/components/ValidationResult';

describe('<ValidationResult /> Component', () => {
  const mockAcceptedResult = {
    is_valid: true,
    algorithm_used: 'VF2',
    status: {
      engine_ms: 12,
      expected_nodes: 2,
      student_nodes: 2,
      expected_edges: 1,
      student_edges: 1,
    },
    names: {
      score: 100,
      matched: [
        { expected: 'CUSTOMER', current: 'CUSTOMER', type: 'Node' },
        { expected: 'ACCOUNT', current: 'ACCOUNT', type: 'Node' },
      ],
      missing: [],
      extra: [],
    },
    mismatches: [],
  };

  const mockRejectedResult = {
    is_valid: false,
    algorithm_used: 'VF2',
    status: { engine_ms: 8, expected_nodes: 2, student_nodes: 1 },
    names: { score: 50, missing: ['ACCOUNT'] },
    mismatches: [{ code: 'NODE_COUNT_MISMATCH', message: 'Missing expected table ACCOUNT.' }],
  };

  it('renders Solution Accepted status, score, and matched entities', () => {
    cy.log('Step 1.1: Mount ValidationResult with accepted results mock');
    cy.mount(<ValidationResult result={mockAcceptedResult} onClose={cy.stub()} />);

    cy.log('Step 1.2: Check elements rendering for successful acceptance state');
    cy.get('.relative.bg-neutral-0').contains('Solution Accepted!').should('exist');
    cy.get('.relative.bg-neutral-0').contains('100/100').should('exist');
    cy.get('.relative.bg-neutral-0').contains('CUSTOMER').should('exist');
    cy.get('.relative.bg-neutral-0').contains('ACCOUNT').should('exist');
  });

  it('renders Incorrect Solution status and mismatch issue diagnostics', () => {
    cy.log('Step 2.1: Mount ValidationResult with rejected results mock');
    cy.mount(<ValidationResult result={mockRejectedResult} onClose={cy.stub()} />);

    cy.log('Step 2.2: Check components rendering incorrect status and issue message');
    cy.get('.relative.bg-neutral-0').contains('Incorrect Solution').should('exist');
    cy.get('.relative.bg-neutral-0').contains('Missing expected table ACCOUNT.').should('exist');
  });

  it('triggers onClose when backdrop is clicked', () => {
    cy.log('Step 3.1: Mount with spy close callback');
    const onCloseSpy = cy.spy().as('onCloseSpy');
    cy.mount(<ValidationResult result={mockAcceptedResult} onClose={onCloseSpy} />);

    cy.log('Step 3.2: Click blurred backdrop area');
    cy.get('.backdrop-blur-sm').click({ force: true });

    cy.log('Step 3.3: Verify close callback spy was invoked');
    cy.get('@onCloseSpy').should('have.been.calledOnce');
  });
});
