package auth

import "testing"

func TestHashAndVerifyPassword(t *testing.T) {
	hash, err := HashPassword("s3cret!")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	if ok, err := VerifyPassword("s3cret!", hash); err != nil || !ok {
		t.Fatalf("expected valid password, ok=%v err=%v", ok, err)
	}
	if ok, err := VerifyPassword("wrong", hash); err != nil || ok {
		t.Fatalf("expected invalid password, ok=%v err=%v", ok, err)
	}
}
