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
    cy.mount(<ValidationResult result={mockAcceptedResult} onClose={cy.stub()} />);

    cy.get('.relative.bg-neutral-0').contains('Solution Accepted!').should('exist');
    cy.get('.relative.bg-neutral-0').contains('100/100').should('exist');
    cy.get('.relative.bg-neutral-0').contains('CUSTOMER').should('exist');
    cy.get('.relative.bg-neutral-0').contains('ACCOUNT').should('exist');
  });

  it('renders Incorrect Solution status and mismatch issue diagnostics', () => {
    cy.mount(<ValidationResult result={mockRejectedResult} onClose={cy.stub()} />);

    cy.get('.relative.bg-neutral-0').contains('Incorrect Solution').should('exist');
    cy.get('.relative.bg-neutral-0').contains('Missing expected table ACCOUNT.').should('exist');
  });

  it('triggers onClose when backdrop is clicked', () => {
    const onCloseSpy = cy.spy().as('onCloseSpy');
    cy.mount(<ValidationResult result={mockAcceptedResult} onClose={onCloseSpy} />);

    // Click backdrop
    cy.get('.backdrop-blur-sm').click({ force: true });
    cy.get('@onCloseSpy').should('have.been.calledOnce');
  });
});
