/**
 * Travel Rule Service Tests for CRYPTRAC
 */

import {
  initiateTravelRule,
  updateTravelRuleStatus,
  submitBeneficiaryInfo,
  checkTravelRuleCompliance,
  expireStaleRecords,
  getTravelRuleStats,
  registerVASP,
  getVASPs,
  _travelRuleStore,
  _vaspStore,
} from '../travel-rule.service';
import { TravelRuleStatus } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clearStores(): void {
  _travelRuleStore.clear();
  _vaspStore.clear();
}

const originator = {
  name: 'Alice Smith',
  accountNumber: '0xABCDEF',
  country: 'NG',
  institutionName: 'TestVASP',
};

const beneficiary = {
  name: 'Bob Jones',
  accountNumber: '0x123456',
  country: 'US',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Travel Rule Service', () => {
  beforeEach(clearStores);

  // -----------------------------------------------------------------------
  // initiateTravelRule
  // -----------------------------------------------------------------------

  describe('initiateTravelRule', () => {
    it('should create a PENDING record for amounts at or above the threshold', () => {
      const record = initiateTravelRule('tx-1', originator, beneficiary, 1, 1000, 'BTC', 'bitcoin');
      expect(record.id).toBeDefined();
      expect(record.status).toBe(TravelRuleStatus.PENDING);
      expect(record.isAboveThreshold).toBe(true);
      expect(record.transactionId).toBe('tx-1');
    });

    it('should create an EXEMPT record for amounts below the threshold', () => {
      const record = initiateTravelRule('tx-2', originator, beneficiary, 0.001, 999, 'BTC', 'bitcoin');
      expect(record.status).toBe(TravelRuleStatus.EXEMPT);
      expect(record.isAboveThreshold).toBe(false);
    });

    it('should set a 72-hour expiry', () => {
      const before = Date.now();
      const record = initiateTravelRule('tx-3', originator, beneficiary, 1, 5000, 'ETH', 'ethereum');
      const after = Date.now();

      const expectedExpiry = before + 72 * 60 * 60 * 1000;
      expect(record.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedExpiry - 100);
      expect(record.expiresAt.getTime()).toBeLessThanOrEqual(after + 72 * 60 * 60 * 1000 + 100);
    });

    it('should add a compliance note when below threshold', () => {
      const record = initiateTravelRule('tx-4', originator, beneficiary, 0.001, 500, 'BTC', 'bitcoin');
      expect(record.complianceNotes.length).toBeGreaterThan(0);
      expect(record.complianceNotes[0]).toContain('below');
    });
  });

  // -----------------------------------------------------------------------
  // updateTravelRuleStatus
  // -----------------------------------------------------------------------

  describe('updateTravelRuleStatus', () => {
    it('should update the status of an existing record', () => {
      const record = initiateTravelRule('tx-10', originator, beneficiary, 1, 5000, 'BTC', 'bitcoin');
      const updated = updateTravelRuleStatus(record.id, TravelRuleStatus.COMPLIANT, 'All checks passed');
      expect(updated.status).toBe(TravelRuleStatus.COMPLIANT);
      expect(updated.complianceNotes).toContain('All checks passed');
    });

    it('should throw 404 for non-existent record', () => {
      expect(() => updateTravelRuleStatus('non-existent', TravelRuleStatus.COMPLIANT)).toThrow();
      try {
        updateTravelRuleStatus('non-existent', TravelRuleStatus.COMPLIANT);
      } catch (err) {
        expect((err as Error & { statusCode: number }).statusCode).toBe(404);
      }
    });

    it('should set completedAt when transitioning to COMPLIANT or NON_COMPLIANT', () => {
      const record = initiateTravelRule('tx-11', originator, beneficiary, 1, 5000, 'BTC', 'bitcoin');
      const updated = updateTravelRuleStatus(record.id, TravelRuleStatus.COMPLIANT);
      expect(updated.completedAt).toBeInstanceOf(Date);
    });
  });

  // -----------------------------------------------------------------------
  // submitBeneficiaryInfo
  // -----------------------------------------------------------------------

  describe('submitBeneficiaryInfo', () => {
    it('should fill in beneficiary info and update status', () => {
      const record = initiateTravelRule('tx-20', originator, beneficiary, 1, 5000, 'BTC', 'bitcoin');
      const newBeneficiary = { name: 'Carol White', accountNumber: '0xWHITE', country: 'GB' };
      const updated = submitBeneficiaryInfo(record.id, newBeneficiary);

      expect(updated.beneficiaryInfo.name).toBe('Carol White');
      expect(updated.status).toBe(TravelRuleStatus.BENEFICIARY_INFO_RECEIVED);
      expect(updated.complianceNotes.some((n) => n.includes('Beneficiary information received'))).toBe(true);
    });

    it('should throw 404 for non-existent record', () => {
      expect(() => submitBeneficiaryInfo('non-existent', beneficiary)).toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // checkTravelRuleCompliance
  // -----------------------------------------------------------------------

  describe('checkTravelRuleCompliance', () => {
    it('should return compliant with no missing fields', () => {
      const record = initiateTravelRule('tx-30', originator, beneficiary, 1, 5000, 'BTC', 'bitcoin');
      const result = checkTravelRuleCompliance(record.id);
      expect(result.isCompliant).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it('should identify missing required originator name', () => {
      const badOriginator = { ...originator, name: '' };
      const record = initiateTravelRule('tx-31', badOriginator, beneficiary, 1, 5000, 'BTC', 'bitcoin');
      const result = checkTravelRuleCompliance(record.id);
      expect(result.isCompliant).toBe(false);
      expect(result.missingFields).toContain('originatorInfo.name');
    });

    it('should identify missing beneficiary name', () => {
      const badBeneficiary = { ...beneficiary, name: '' };
      const record = initiateTravelRule('tx-32', originator, badBeneficiary, 1, 5000, 'BTC', 'bitcoin');
      const result = checkTravelRuleCompliance(record.id);
      expect(result.isCompliant).toBe(false);
      expect(result.missingFields).toContain('beneficiaryInfo.name');
    });

    it('should return compliant with exempt status (below threshold)', () => {
      const record = initiateTravelRule('tx-33', originator, beneficiary, 0.001, 100, 'BTC', 'bitcoin');
      const result = checkTravelRuleCompliance(record.id);
      expect(result.isCompliant).toBe(true);
    });

    it('should throw 404 for non-existent record', () => {
      expect(() => checkTravelRuleCompliance('non-existent')).toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // expireStaleRecords
  // -----------------------------------------------------------------------

  describe('expireStaleRecords', () => {
    it('should mark expired PENDING records', () => {
      const record = initiateTravelRule('tx-40', originator, beneficiary, 1, 5000, 'BTC', 'bitcoin');
      // Manually set expiresAt to the past
      _travelRuleStore.get(record.id)!.expiresAt = new Date(Date.now() - 1000);

      const count = expireStaleRecords();
      expect(count).toBe(1);
      expect(_travelRuleStore.get(record.id)!.status).toBe(TravelRuleStatus.EXPIRED);
    });

    it('should not expire records that are not yet expired', () => {
      initiateTravelRule('tx-41', originator, beneficiary, 1, 5000, 'BTC', 'bitcoin');
      const count = expireStaleRecords();
      expect(count).toBe(0);
    });

    it('should not expire COMPLIANT records', () => {
      const record = initiateTravelRule('tx-42', originator, beneficiary, 1, 5000, 'BTC', 'bitcoin');
      updateTravelRuleStatus(record.id, TravelRuleStatus.COMPLIANT);
      _travelRuleStore.get(record.id)!.expiresAt = new Date(Date.now() - 1000);

      const count = expireStaleRecords();
      expect(count).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // getTravelRuleStats
  // -----------------------------------------------------------------------

  describe('getTravelRuleStats', () => {
    it('should return accurate counts', () => {
      const r1 = initiateTravelRule('tx-50', originator, beneficiary, 1, 5000, 'BTC', 'bitcoin');
      updateTravelRuleStatus(r1.id, TravelRuleStatus.COMPLIANT);
      initiateTravelRule('tx-51', originator, beneficiary, 1, 500, 'ETH', 'ethereum'); // EXEMPT

      const stats = getTravelRuleStats();
      expect(stats.total).toBe(2);
      expect(stats.compliant).toBe(1);
      expect(stats.exempt).toBe(1);
      expect(stats.complianceRate).toBe(100); // 1/1 eligible
    });

    it('should return 100% compliance rate when no eligible records exist', () => {
      initiateTravelRule('tx-52', originator, beneficiary, 0.001, 100, 'BTC', 'bitcoin');
      const stats = getTravelRuleStats();
      expect(stats.complianceRate).toBe(100);
    });
  });

  // -----------------------------------------------------------------------
  // registerVASP
  // -----------------------------------------------------------------------

  describe('registerVASP', () => {
    it('should create a VASP entry with id and timestamps', () => {
      const vasp = registerVASP({
        name: 'TestVASP',
        registrationNumber: 'REG-001',
        country: 'NG',
        regulatoryAuthority: 'CBN',
        isVerified: true,
        supportedNetworks: ['bitcoin', 'ethereum'],
      });

      expect(vasp.id).toBeDefined();
      expect(vasp.name).toBe('TestVASP');
      expect(vasp.createdAt).toBeInstanceOf(Date);
    });
  });

  // -----------------------------------------------------------------------
  // getVASPs
  // -----------------------------------------------------------------------

  describe('getVASPs', () => {
    beforeEach(() => {
      registerVASP({ name: 'VASP-NG', registrationNumber: 'R1', country: 'NG', regulatoryAuthority: 'CBN', isVerified: true, supportedNetworks: [] });
      registerVASP({ name: 'VASP-US', registrationNumber: 'R2', country: 'US', regulatoryAuthority: 'FinCEN', isVerified: false, supportedNetworks: [] });
      registerVASP({ name: 'VASP-GB', registrationNumber: 'R3', country: 'GB', regulatoryAuthority: 'FCA', isVerified: true, supportedNetworks: [] });
    });

    it('should filter by country', () => {
      const vasps = getVASPs({ country: 'NG' });
      expect(vasps).toHaveLength(1);
      expect(vasps[0].name).toBe('VASP-NG');
    });

    it('should filter by isVerified', () => {
      const verified = getVASPs({ isVerified: true });
      expect(verified).toHaveLength(2);
      const unverified = getVASPs({ isVerified: false });
      expect(unverified).toHaveLength(1);
    });

    it('should return all VASPs without filters', () => {
      const all = getVASPs();
      expect(all).toHaveLength(3);
    });
  });
});
