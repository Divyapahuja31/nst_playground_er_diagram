import TableListItem from '../../src/components/TableListItem';

describe('Field Options Popover Component', () => {
  const mockTable = {
    id: 't1',
    name: 'USERS',
    columns: [{ name: 'id', type: 'INTEGER', isPrimary: false }],
  };

  it('renders field options popover with 4 options when clicking •••', () => {
    cy.mount(<TableListItem table={mockTable} onUpdate={cy.stub()} onDelete={cy.stub()} />);

    // Expand table accordion
    cy.contains('USERS').click();

    // Click field options button •••
    cy.get('button[title="Field options"]').click();

    // Verify popover options appear
    cy.contains('Primary Key').should('be.visible');
    cy.contains('Not Null').should('be.visible');
    cy.contains('Unique').should('be.visible');
    cy.contains('Auto Increment').should('be.visible');
  });

  it('triggers onUpdate when toggling a switch option', () => {
    const onUpdateSpy = cy.spy().as('onUpdateSpy');
    cy.mount(<TableListItem table={mockTable} onUpdate={onUpdateSpy} onDelete={cy.stub()} />);

    cy.contains('USERS').click();
    cy.get('button[title="Field options"]').click();

    // Toggle Primary Key switch
    cy.get('[role="switch"]').first().click();

    cy.get('@onUpdateSpy').should('have.been.called');
  });
});
