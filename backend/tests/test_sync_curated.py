from seeds.scrapers import curated


def test_fizzbuzz_curated_matches_single_number_spec():
    by_slug = {p["slug"]: p for p in curated.scrape()}
    fb = by_slug["fizzbuzz"]
    assert "Read an integer n" in fb["description"]
    assert "1 to n" not in fb["description"].lower()
    assert fb["examples"][0] == {"input": "15", "output": "FizzBuzz"}
