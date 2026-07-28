import TableListItem from '../../src/components/TableListItem';

describe('Field Options Popover Component', () => {
  const mockTable = {
    id: 't1',
    name: 'USERS',
    columns: [{ name: 'id', type: 'INTEGER', isPrimary: false }],
  };

  it('renders field options popover with 4 options when clicking •••', () => {
    cy.log('Step 1.1: Mount component within TableListItem');
    cy.mount(<TableListItem table={mockTable} onUpdate={cy.stub()} onDelete={cy.stub()} />);

    cy.log('Step 1.2: Expand table accordion');
    cy.contains('USERS').click();

    cy.log('Step 1.3: Click field options button (•••)');
    cy.get('button[title="Field options"]').click();

    cy.log('Step 1.4: Verify popover option labels render in UI');
    cy.contains('Primary Key').should('be.visible');
    cy.contains('Not Null').should('be.visible');
    cy.contains('Unique').should('be.visible');
    cy.contains('Auto Increment').should('be.visible');
  });

  it('triggers onUpdate when toggling a switch option', () => {
    cy.log('Step 2.1: Mount with spy update callback');
    const onUpdateSpy = cy.spy().as('onUpdateSpy');
    cy.mount(<TableListItem table={mockTable} onUpdate={onUpdateSpy} onDelete={cy.stub()} />);

    cy.log('Step 2.2: Open field options popover');
    cy.contains('USERS').click();
    cy.get('button[title="Field options"]').click();

    cy.log('Step 2.3: Toggle the Primary Key switch');
    cy.get('[role="switch"]').first().click();

    cy.log('Step 2.4: Verify update callback spy was invoked');
    cy.get('@onUpdateSpy').should('have.been.called');
  });
});
