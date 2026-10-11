import { fitFieldsChanged } from './profile.component';

describe( 'fitFieldsChanged', () => {
  it( 'only counts the six fields TODD scores against', () => {
    const before = { companyName: 'Taliferro Tech', profession: 'Founder', companyDescription: 'Portals', jobDescriptionForTODD: '', valueProp: '', companyGoal: '', phone: '1' };
    expect( fitFieldsChanged( before, { ...before, phone: '2' } ) ).toBeFalse();
    expect( fitFieldsChanged( before, { ...before, valueProp: 'Small releases' } ) ).toBeTrue();
    expect( fitFieldsChanged( before, { ...before, companyName: ' Taliferro Tech ' } ) ).toBeFalse();
    expect( fitFieldsChanged( null, before ) ).toBeTrue();
  } );
} );
