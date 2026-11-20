package grades

import "testing"

func ptr(v float64) *float64 { return &v }

func TestPointsToGrade(t *testing.T) {
	cases := []struct {
		points float64
		want   float64
	}{
		{100, 10}, {91, 10}, {90, 9}, {81, 9}, {80, 8}, {70, 7},
		{60, 6}, {50, 5}, {41, 5}, {40, 4}, {0, 4}, {120, 10}, {-5, 4},
	}
	for _, c := range cases {
		if got := PointsToGrade(c.points, DefaultBands); got != c.want {
			t.Errorf("PointsToGrade(%v) = %v, want %v", c.points, got, c.want)
		}
	}
}

func TestPointsToGradeFallsBackWithoutBands(t *testing.T) {
	if got := PointsToGrade(85, nil); got != 9 {
		t.Errorf("nil bands should fall back to the default scale, got %v", got)
	}
}

func TestIsPass(t *testing.T) {
	if !IsPass(5, 5) {
		t.Error("5 should pass with pass grade 5")
	}
	if IsPass(4, 5) {
		t.Error("4 should fail with pass grade 5")
	}
	if IsPass(4, 0) {
		t.Error("a zero pass grade should fall back to the default")
	}
}

func TestWeightedTotalMidSemester(t *testing.T) {
	// midterm 40% (80/100) graded, final 60% not graded yet
	total := WeightedTotal([]Component{
		{ID: "mid", Weight: 40, MaxPoints: 100, Points: ptr(80)},
		{ID: "final", Weight: 60, MaxPoints: 100},
	}, DefaultBands)

	if total.Points == nil || *total.Points != 80 {
		t.Fatalf("expected provisional total 80, got %v", total.Points)
	}
	if total.Grade == nil || *total.Grade != 8 {
		t.Fatalf("expected grade 8, got %v", total.Grade)
	}
	if total.Coverage != 0.4 {
		t.Fatalf("expected coverage 0.4, got %v", total.Coverage)
	}
	if len(total.Missing) != 1 || total.Missing[0] != "final" {
		t.Fatalf("expected final to be missing, got %v", total.Missing)
	}
	if got := StatusFor(total.Grade, total.Coverage, DefaultPassGrade); got != "in_progress" {
		t.Fatalf("partial coverage must stay in_progress, got %s", got)
	}
}

func TestWeightedTotalWeightsDiffer(t *testing.T) {
	// 30/100 on a 30% component and 90/100 on a 70% component
	total := WeightedTotal([]Component{
		{ID: "a", Weight: 30, MaxPoints: 100, Points: ptr(30)},
		{ID: "b", Weight: 70, MaxPoints: 100, Points: ptr(90)},
	}, DefaultBands)

	// (30*0.3 + 90*0.7) / 1.0 = 72
	if total.Points == nil || *total.Points != 72 {
		t.Fatalf("expected 72, got %v", total.Points)
	}
	if total.Coverage != 1 {
		t.Fatalf("expected full coverage, got %v", total.Coverage)
	}
	if got := StatusFor(total.Grade, total.Coverage, DefaultPassGrade); got != "passed" {
		t.Fatalf("expected passed, got %s", got)
	}
}

func TestWeightedTotalNormalisesMaxPoints(t *testing.T) {
	// a component graded out of 20 points counts as a percentage
	total := WeightedTotal([]Component{
		{ID: "a", Weight: 50, MaxPoints: 20, Points: ptr(10)},
		{ID: "b", Weight: 50, MaxPoints: 100, Points: ptr(90)},
	}, DefaultBands)

	// (50 + 90) / 2 = 70
	if total.Points == nil || *total.Points != 70 {
		t.Fatalf("expected 70, got %v", total.Points)
	}
}

func TestWeightedTotalEmpty(t *testing.T) {
	total := WeightedTotal(nil, DefaultBands)
	if total.Points != nil || total.Grade != nil || total.Coverage != 0 {
		t.Fatalf("expected an empty total, got %+v", total)
	}
}

func TestStatusFor(t *testing.T) {
	if got := StatusFor(nil, 0, 5); got != "in_progress" {
		t.Errorf("no grade should be in_progress, got %s", got)
	}
	if got := StatusFor(ptr(4), 1, 5); got != "failed" {
		t.Errorf("grade 4 fully covered should fail, got %s", got)
	}
	if got := StatusFor(ptr(8), 0.5, 5); got != "in_progress" {
		t.Errorf("half coverage should stay in_progress, got %s", got)
	}
}

func TestSummarise(t *testing.T) {
	summary := Summarise([]Result{
		{Grade: ptr(10), ECTS: ptr(6), Status: "passed"},
		{Grade: ptr(6), ECTS: ptr(3), Status: "passed"},
		{Grade: ptr(4), ECTS: ptr(6), Status: "failed"},
		{Grade: nil, ECTS: ptr(5), Status: "in_progress"},
	})

	// (10*6 + 6*3) / 9 = 8.67
	if summary.GPA == nil || *summary.GPA != 8.67 {
		t.Fatalf("expected GPA 8.67, got %v", summary.GPA)
	}
	if summary.CreditsEarned != 9 {
		t.Fatalf("expected 9 credits earned, got %v", summary.CreditsEarned)
	}
	if summary.CreditsInFlight != 5 {
		t.Fatalf("expected 5 credits in flight, got %v", summary.CreditsInFlight)
	}
	if summary.SubjectsPassed != 2 || summary.SubjectsFailed != 1 {
		t.Fatalf("unexpected counts: %+v", summary)
	}
}

func TestSummariseWithoutPassedSubjects(t *testing.T) {
	summary := Summarise([]Result{{Grade: nil, ECTS: ptr(6), Status: "in_progress"}})
	if summary.GPA != nil {
		t.Fatalf("expected no GPA, got %v", *summary.GPA)
	}
	if summary.CreditsInFlight != 6 {
		t.Fatalf("expected 6 credits in flight, got %v", summary.CreditsInFlight)
	}
}
