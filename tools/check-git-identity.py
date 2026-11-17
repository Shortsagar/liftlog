#!/usr/bin/env python3
"""Fail closed if a commit or pushed history exposes an unapproved identity."""
import subprocess
import sys

NAME = 'shortsagar'
EMAIL = '314394435+Shortsagar@users.noreply.github.com'


def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()


def check(name, email):
    if (name, email) != (NAME, EMAIL):
        raise ValueError('Identity privacy check blocked this operation. Use shortsagar and the approved GitHub noreply email for BOTH author and committer. No private identity is printed.')


def main():
    if sys.argv[1:] == ['commit']:
        for field in ['GIT_AUTHOR_IDENT', 'GIT_COMMITTER_IDENT']:
            ident = git('var', field)
            name, rest = ident.rsplit(' <', 1)
            check(name, rest.split('>', 1)[0])
    elif sys.argv[1:] == ['push']:
        checked = set()
        for line in sys.stdin:
            local_ref, local_sha, remote_ref, remote_sha = line.split()
            if set(local_sha) == {'0'}:
                continue  # Deletion publishes no new identity.
            # Scan all ancestors, not just the tip or the remote-tracking delta.
            # This also catches old commits reintroduced by merges and tags.
            tip = git('rev-parse', '--verify', local_sha + '^{commit}')
            for sha in git('rev-list', tip).splitlines():
                if sha in checked:
                    continue
                checked.add(sha)
                fields = git('show', '-s', '--format=%an%n%ae%n%cn%n%ce', sha).splitlines()
                if len(fields) != 4:
                    raise ValueError('Cannot safely verify commit identity')
                check(*fields[:2])
                check(*fields[2:])
            # Annotated tags carry an additional tagger identity.
            obj = local_sha
            while git('cat-file', '-t', obj) == 'tag':
                headers = git('cat-file', 'tag', obj).split('\n\n', 1)[0].splitlines()
                tagger = next(x[7:] for x in headers if x.startswith('tagger '))
                name, rest = tagger.rsplit(' <', 1)
                check(name, rest.split('>', 1)[0])
                obj = next(x[7:] for x in headers if x.startswith('object '))
    else:
        raise ValueError('Expected commit or push mode')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
