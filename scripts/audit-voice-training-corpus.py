"""Read-only gate for real published training clips; never runs training.

Input JSONL: id, audio (relative WAV), text, language th/en, speaker_id,
source (common-voice-27-th/librispeech), publisher_split train, real_human true,
synthetic false, source_revision. Exclusion JSONL uses identical schema plus
audio_sha256/pcm_sha256 if audio is not stored locally. No identity lookup.
"""
import argparse
import hashlib
import json
import pathlib
import wave

SOURCES = {
    'common-voice-27-th': {'language': 'th', 'license': 'CC0-1.0', 'url': 'https://mozilladatacollective.com/datasets/cmu5x5tj000f2nq0755h8qcy5'},
    'librispeech': {'language': 'en', 'license': 'CC-BY-4.0', 'url': 'https://www.openslr.org/12/'},
}


def rows(path):
    with pathlib.Path(path).open(encoding='utf-8') as handle:
        for line in handle:
            if line.strip():
                yield json.loads(line)


def digest_audio(base, row):
    base = pathlib.Path(base).resolve(strict=True)
    path = (base / row['audio']).resolve(strict=True)
    if not path.is_relative_to(base) or path.suffix.lower() != '.wav':
        raise ValueError('Audio must be a WAV inside the corpus root')
    with wave.open(str(path), 'rb') as audio:
        if (audio.getnchannels(), audio.getsampwidth(), audio.getframerate(), audio.getcomptype()) != (1, 2, 16000, 'NONE'):
            raise ValueError('Canonical audio must be mono PCM16 16000 Hz')
        count = audio.getnframes()
        if not 1600 <= count <= 480000:
            raise ValueError('Duration outside the frozen 0.1..30 second corpus bounds')
        digest = hashlib.sha256()
        total = 0
        while True:
            block = audio.readframes(16000)
            if not block:
                break
            digest.update(block)
            total += len(block)
        if total != count * 2:
            raise ValueError('Truncated audio')
    return digest.hexdigest(), count


def audit(manifest, root, exclusions, minimum=100000, minimum_each=50000):
    base = pathlib.Path(root).resolve(strict=True)
    excluded_ids, excluded_pcm, excluded_speakers = set(), set(), set()
    for excluded in rows(exclusions):
        excluded_ids.add((excluded['source'], excluded['id']))
        if excluded.get('pcm_sha256'):
            excluded_pcm.add(excluded['pcm_sha256'])
        if excluded.get('speaker_id'):
            excluded_speakers.add((excluded['source'], excluded['speaker_id']))
    seen_ids, seen_pcm, speakers = set(), set(), set()
    counts = {'th': 0, 'en': 0}
    seconds, failures, rejected, evaluated = 0, [], 0, 0
    for index, row in enumerate(rows(manifest), 1):
        evaluated += 1
        try:
            source = SOURCES[row['source']]
            if row.get('language') != source['language'] or row.get('license') != source['license'] or row.get('publisher_url') != source['url']:
                raise ValueError('Publisher provenance/language/license mismatch')
            if row.get('real_human') is not True or row.get('synthetic') is not False or row.get('publisher_split') != 'train':
                raise ValueError('Only real publisher training speech is allowed')
            if not all(isinstance(row.get(key), str) and row[key].strip() for key in ['id', 'speaker_id', 'text', 'source_revision']):
                raise ValueError('Missing transcript, speaker, clip ID or pinned revision')
            identity = (row['source'], row['id'])
            speaker = (row['source'], row['speaker_id'])
            if identity in seen_ids or identity in excluded_ids or speaker in excluded_speakers:
                raise ValueError('Duplicate ID or overlap with development/held speaker')
            pcm, frames = digest_audio(base, row)
            if pcm in seen_pcm or pcm in excluded_pcm:
                raise ValueError('Duplicate canonical PCM or development/held audio overlap')
            seen_ids.add(identity)
            seen_pcm.add(pcm)
            speakers.add(speaker)
            counts[row['language']] += 1
            seconds += frames / 16000
        except (ValueError, KeyError, OSError, wave.Error) as error:
            rejected += 1
            failures.append({'line': index, 'id': row.get('id'), 'reason': str(error)})
    accepted = len(seen_pcm)
    return {'version': 1, 'required_unique_real_training_clips': minimum, 'required_each_language': minimum_each,
            'evaluated': evaluated, 'accepted_unique_pcm': accepted, 'language_counts': counts,
            'unique_pseudonymous_speakers': len(speakers), 'hours': seconds / 3600, 'rejected': rejected,
            'failures': failures, 'all_failures_retained': True,
            'training_ready': rejected == 0 and accepted >= minimum and all(n >= minimum_each for n in counts.values()),
            'training_performed': False, 'weight_updates': 0, 'semantic_duplicate_detection': False,
            'deduplication': 'publisher clip ID and canonical PCM SHA256, without augmentation',
            'source_attestation': 'requires reviewed publisher archive/import provenance; input labels alone do not prove human origin'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--root', required=True)
    parser.add_argument('--exclusions', required=True)
    args = parser.parse_args()
    result = audit(args.manifest, args.root, args.exclusions)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result['training_ready'] else 2)
