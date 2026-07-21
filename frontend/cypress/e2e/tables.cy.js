describe('Table Management Test', () => {
  beforeEach(() => {
    // Intercept backend questions load
    cy.intercept('GET', '**/questions', {
      statusCode: 200,
      body: [{ id: '1', title: 'Test Question' }]
    }).as('getQuestions');

    cy.intercept('GET', '**/questions/1', {
      statusCode: 200,
      body: {
        id: '1',
        title: 'Test Question',
        question: 'Create table Users.'
      }
    }).as('getQuestionDetail');

    cy.visit('/');
  });

  it('allows adding and removing a table', () => {
    // 1. Open the modal
    cy.contains('button', 'Add Table').click();
    cy.get('input[placeholder="Enter table name..."]').type('Users');
    cy.contains('button', /^Add$/).click();

    // 2. Verify table exists in the right sidebar list
    cy.get('.flex-1.overflow-y-auto').contains('Users').should('exist');

    // 3. Expand the table first, then delete it
    cy.get('.flex-1.overflow-y-auto').contains('Users').click();
    cy.get('button[title="Delete table"]').click();
    cy.get('.flex-1.overflow-y-auto').should('not.contain', 'Users');
  });

  it('allows adding and removing columns in a table', () => {
    // 1. Add table
    cy.contains('button', 'Add Table').click();
    cy.get('input[placeholder="Enter table name..."]').type('Users');
    cy.contains('button', /^Add$/).click();

    // 2. Expand the table item in RightSidebar
    cy.get('.flex-1.overflow-y-auto').contains('Users').click();

    // 3. Add field
    cy.contains('button', 'Add field').click();
    cy.get('input[placeholder="field"]').clear().type('id');
    
    // Select column type
    cy.get('select').select('INTEGER');

    // 4. Verify it displays in the canvas
    cy.get('.react-flow__node-tableNode').should('contain', 'id');
  });
});