package auth

import "testing"

func TestValidActiveAccount(t *testing.T) {
	if !Authenticate(false, true) {
		t.Fatal("active account with valid credentials was rejected")
	}
}

func TestBlockedAccountWithValidCredentials(t *testing.T) {
	if Authenticate(true, true) {
		t.Fatal("blocked account with valid credentials was authenticated")
	}
}

func TestInvalidCredentials(t *testing.T) {
	for _, blocked := range []bool{false, true} {
		if Authenticate(blocked, false) {
			t.Fatalf("account with blocked=%t and invalid credentials was authenticated", blocked)
		}
	}
}
