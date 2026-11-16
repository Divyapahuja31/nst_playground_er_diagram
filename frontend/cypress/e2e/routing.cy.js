describe('Question Routing Test Suite', () => {
  beforeEach(() => {
    cy.intercept('GET', 'http://localhost:8000/questions', {
      statusCode: 200,
      body: [
        { id: '101', title: 'Hospital Management System', question: 'Design hospital DB', is_published: true },
        { id: '102', title: 'Library Catalog', question: 'Design library DB', is_published: true },
      ]
    }).as('getQuestions');

    cy.intercept('GET', 'http://localhost:8000/questions/101*', {
      statusCode: 200,
      body: {
        id: '101',
        title: 'Hospital Management System',
        question: 'Design hospital database schema with Patients and Doctors.'
      }
    }).as('getQuestion101');

    cy.intercept('GET', 'http://localhost:8000/questions/102*', {
      statusCode: 200,
      body: {
        id: '102',
        title: 'Library Catalog',
        question: 'Design library database schema with Books and Authors.'
      }
    }).as('getQuestion102');
  });

  it('navigates to question URL when clicking on a question card', () => {
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('auth_token', 'fake-token');
        win.localStorage.setItem('auth_user', JSON.stringify({ id: '1', role: 'STUDENT', full_name: 'Test Student' }));
      }
    });

    cy.wait('@getQuestions');
    cy.contains('Hospital Management System').should('be.visible');

    // Click to open question 101
    cy.contains('Hospital Management System').click();
    cy.wait('@getQuestion101');

    // URL must update to /questions/101
    cy.url().should('include', '/questions/101');
    cy.contains('Design hospital database schema with Patients and Doctors.').should('be.visible');

    // Click Back button
    cy.contains('button', 'Back').click();

    // URL must return to root /
    cy.url().should('match', /\/$/);
    cy.contains('Hospital Management System').should('be.visible');
  });

  it('directly loads question workspace when visiting /questions/:id URL', () => {
    cy.visit('/questions/102', {
      onBeforeLoad(win) {
        win.localStorage.setItem('auth_token', 'fake-token');
        win.localStorage.setItem('auth_user', JSON.stringify({ id: '1', role: 'STUDENT', full_name: 'Test Student' }));
      }
    });

    cy.wait('@getQuestion102');
    cy.url().should('include', '/questions/102');
    cy.contains('Library Catalog').should('be.visible');
    cy.contains('Design library database schema with Books and Authors.').should('be.visible');
  });
});
