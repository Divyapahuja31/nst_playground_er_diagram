import TableListItem from '../../src/components/TableListItem';

describe('<TableListItem /> Component', () => {
  const mockTable = {
    id: 'table-1',
    name: 'ACCOUNT',
    columns: [
      { name: 'account_id', type: 'INTEGER', isPrimary: true },
      { name: 'balance', type: 'FLOAT', isPrimary: false },
    ],
  };

  it('renders collapsed table header and toggles accordion on click', () => {
    cy.mount(<TableListItem table={mockTable} onUpdate={cy.stub()} onDelete={cy.stub()} />);

    cy.contains('ACCOUNT').should('be.visible');

    // Add field button should not be visible when collapsed
    cy.contains('Add field').should('not.exist');

    // Expand accordion
    cy.contains('ACCOUNT').click();

    // Expanded items should now be visible
    cy.contains('Add field').should('be.visible');
    cy.get('button[title="Delete table"]').should('be.visible');
  });

  it('triggers onUpdate when editing table name', () => {
    const onUpdateSpy = cy.spy().as('onUpdateSpy');
    cy.mount(<TableListItem table={mockTable} onUpdate={onUpdateSpy} onDelete={cy.stub()} />);

    cy.contains('ACCOUNT').click();
    cy.get('input[value="ACCOUNT"]').clear().type('ACCOUNTS');

    cy.get('@onUpdateSpy').should('have.been.called');
  });

  it('triggers onDelete when clicking delete table button', () => {
    const onDeleteSpy = cy.spy().as('onDeleteSpy');
    cy.mount(<TableListItem table={mockTable} onUpdate={cy.stub()} onDelete={onDeleteSpy} />);

    cy.contains('ACCOUNT').click();
    cy.get('button[title="Delete table"]').click();

    cy.get('@onDeleteSpy').should('have.been.calledOnce');
  });
});
