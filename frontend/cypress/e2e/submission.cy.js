describe('Submission & Validation Flow Test', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/questions', {
      statusCode: 200,
      body: [{ id: '1', title: 'Banking ER Diagram' }]
    }).as('getQuestions');

    cy.intercept('GET', '**/questions/1*', {
      statusCode: 200,
      body: {
        id: '1',
        title: 'Banking ER Diagram',
        question: 'Design a banking system with CUSTOMER and ACCOUNT.'
      }
    }).as('getQuestionDetail');

    cy.intercept('POST', '**/submit*', {
      statusCode: 200,
      body: {
        is_valid: true,
        algorithm_used: 'VF2',
        status: {
          engine_ms: 15,
          expected_nodes: 1,
          student_nodes: 1,
          expected_edges: 0,
          student_edges: 0
        },
        names: {
          score: 100,
          matched: [{ expected: 'CUSTOMER', current: 'CUSTOMER', type: 'Node' }],
          missing: [],
          extra: []
        },
        mismatches: []
      }
    }).as('submitSolution');

    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('auth_token', 'fake-token');
        win.localStorage.setItem('auth_user', JSON.stringify({ id: '1', role: 'STUDENT', full_name: 'Test Student' }));
      }
    });
    cy.wait('@getQuestions');
    cy.contains('Solve Assignment').click();
  });

  it('validates guardrails when submitting without tables', () => {
    cy.wait('@getQuestionDetail');

    cy.log('Step 1.1: Click Submit Solution without adding tables');
    cy.contains('button', 'Submit Solution').click();

    cy.log('Step 1.2: Verify error notification is displayed');
    cy.contains('Add at least one table before submitting.').should('be.visible');
  });

  it('submits a valid diagram, verifies validation modal, and resets workspace', () => {
    cy.wait('@getQuestionDetail');

    cy.log('Step 2.1: Create CUSTOMER table');
    cy.contains('button', 'Add Table').click();
    cy.get('input[placeholder="Enter table name..."]').type('CUSTOMER');
    cy.contains('button', /^Add$/).click();

    cy.log('Step 2.2: Submit solution and wait for API');
    cy.contains('button', 'Submit Solution').click();
    cy.wait('@submitSolution');

    cy.log('Step 2.3: Verify ValidationResult modal values');
    cy.contains('Solution Accepted!').should('be.visible');
    cy.contains('100/100').should('be.visible');
    cy.contains('Your diagram structure and relationships match the expected solution.').should('be.visible');

    cy.log('Step 2.4: Close validation modal by clicking backdrop');
    cy.get('.fixed.inset-0.z-\\[100\\] .bg-black\\/40').click({ force: true });
    cy.contains('Solution Accepted!').should('not.exist');

    cy.log('Step 2.5: Reset workspace canvas');
    cy.get('button[title="Reset"]').click();
    cy.get('.flex-1.overflow-y-auto').should('not.contain', 'CUSTOMER');
  });
});
