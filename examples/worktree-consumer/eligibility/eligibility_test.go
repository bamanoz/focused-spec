package eligibility

import "testing"

func TestAdultEligible(t *testing.T) {
	if !Eligible(18) {
		t.Fatal("an adult must be eligible")
	}
}
