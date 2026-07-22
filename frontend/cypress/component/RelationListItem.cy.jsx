import RelationListItem from '../../src/components/RelationListItem';

describe('<RelationListItem /> Component', () => {
  const mockEdge = {
    id: 'edge-1',
    source: 'tbl-1',
    target: 'tbl-2',
    data: {
      name: 'users_profiles_rel',
      cardinality: 'One to One',
      compositeKeys: [],
    },
  };

  const mockTables = [
    { id: 'tbl-1', name: 'Users', columns: [{ name: 'id' }] },
    { id: 'tbl-2', name: 'Profiles', columns: [{ name: 'user_id' }] },
  ];

  it('renders collapsed header and toggles accordion to show properties', () => {
    cy.mount(
      <RelationListItem
        edge={mockEdge}
        tables={mockTables}
        onUpdate={cy.stub()}
        onDelete={cy.stub()}
      />
    );

    cy.contains('users_profiles_rel').should('be.visible');

    // Expand relationship accordion
    cy.contains('users_profiles_rel').click();

    // Verify inputs are populated
    cy.get('input[value="users_profiles_rel"]').should('be.visible');
    cy.get('input[value="Users"]').should('be.visible');
    cy.get('input[value="Profiles"]').should('be.visible');
  });

  it('triggers onUpdate when editing relationship name or cardinality', () => {
    const onUpdateSpy = cy.spy().as('onUpdateSpy');
    cy.mount(
      <RelationListItem
        edge={mockEdge}
        tables={mockTables}
        onUpdate={onUpdateSpy}
        onDelete={cy.stub()}
      />
    );

    cy.contains('users_profiles_rel').click();

    // Edit relationship name
    cy.get('input[value="users_profiles_rel"]').type('{selectall}{backspace}user_link');
    cy.get('@onUpdateSpy').should('have.been.called');

    // Change cardinality
    cy.get('select').first().select('One to Many');
    cy.get('@onUpdateSpy').should('have.been.called');
  });

  it('triggers onDelete when clicking delete relationship button', () => {
    const onDeleteSpy = cy.spy().as('onDeleteSpy');
    cy.mount(
      <RelationListItem
        edge={mockEdge}
        tables={mockTables}
        onUpdate={cy.stub()}
        onDelete={onDeleteSpy}
      />
    );

    cy.contains('users_profiles_rel').click();
    cy.get('button[title="Delete relationship"]').click();

    cy.get('@onDeleteSpy').should('have.been.calledOnce');
  });
});
